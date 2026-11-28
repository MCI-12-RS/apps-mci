-- =============================================================================
-- E4.09: células, uma a uma, pelo legacy_id (5.6).
--   cell_missing  no legado e não no novo (esperada: horário, dia ou tipo inválido, pessoa
--                 inexistente, de fora ou excluída; DT-12, PR2-2)
--   cell_extra    no novo com um Id que o legado não tem
--   cell_status   excluída diferente, ou inativa no novo (o legado não tem célula inativa)
--   cell_field    líder, timóteo, anfitrião (pelo Id do legado), dia, horário, tipo, endereço
-- =============================================================================
WITH /*BASE*/,
n AS (SELECT c.* FROM public.cells c WHERE c.legacy_id IS NOT NULL),
lx AS (
  SELECT c."Id" AS lid, coalesce(c."IsDeleted", false) AS del,
         c."LeadId" AS leader_lid, c."TimothyId" AS timothy_lid, c."HostId" AS host_lid,
         (SELECT d FROM unnest(public.cell_weekdays()) d WHERE public.weekday_index(d) = c."WeekDay") AS meeting_day,
         CASE WHEN btrim(c."Time") ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' THEN btrim(c."Time")::time END AS meeting_time,
         CASE c."CellType" WHEN 0 THEN 'Evangelística' WHEN 1 THEN 'Discipulado' WHEN 2 THEN 'Macrocélula' END AS type,
         ROW(CASE WHEN a."Street" ~ '^[[:space:]]*$' THEN NULL ELSE a."Street" END,
             CASE WHEN a."Number" ~ '^[[:space:]]*$' THEN NULL ELSE a."Number" END,
             CASE WHEN a."Notes" ~ '^[[:space:]]*$' THEN NULL ELSE a."Notes" END,
             CASE WHEN a."Neighborhood" ~ '^[[:space:]]*$' THEN NULL ELSE a."Neighborhood" END,
             CASE WHEN a."City" ~ '^[[:space:]]*$' THEN NULL ELSE a."City" END,
             upper(CASE WHEN btrim(a."State") ~ '^[[:space:]]*$' THEN NULL ELSE btrim(a."State") END),
             public.normalize_digits(a."PostalCode"))::text AS address,
         NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = c."LeadId")
           OR NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = c."TimothyId")
           OR NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = c."HostId") AS person_missing,
         EXISTS (SELECT 1 FROM lmb b WHERE b.lid IN (c."LeadId", c."TimothyId", c."HostId") AND b.del) AS person_deleted
    FROM legacy."Cells" c
    LEFT JOIN legacy."Addresses" a ON a."Id" = c."PlaceId"
),
p AS (
  SELECT l.*, n.id AS nid, n.deleted_at IS NOT NULL AS n_del, n.is_active AS n_active,
         ml.lid AS n_leader_lid, mt.lid AS n_timothy_lid, mh.lid AS n_host_lid,
         n.meeting_day AS n_day, n.meeting_time AS n_time, n.type AS n_type,
         ROW(n.street, n.number, n.complement, n.neighborhood, n.city, n.state, n.zip_code)::text AS n_address
    FROM lx l
    JOIN n ON n.legacy_id = l.lid
    LEFT JOIN idmap ml ON ml.id = n.leader_id
    LEFT JOIN idmap mt ON mt.id = n.timothy_id
    LEFT JOIN idmap mh ON mh.id = n.host_id
)
SELECT 'diff'::text AS kind, 'cell_missing'::text AS code, l.lid::bigint AS lid, NULL::text AS ref,
       CASE WHEN l.del THEN 'excluída no legado' END AS detail,
       nullif(concat_ws(',',
         CASE WHEN l.meeting_time IS NULL THEN 'cell_time_invalid' END,
         CASE WHEN l.meeting_day IS NULL THEN 'cell_weekday_invalid' END,
         CASE WHEN l.type IS NULL THEN 'cell_type_invalid' END,
         CASE WHEN l.person_missing THEN CASE WHEN l.del THEN 'cell_deleted_person_missing' ELSE 'cell_person_missing' END END,
         CASE WHEN NOT l.del AND l.person_deleted THEN 'cell_person_deleted' END
       ), '') AS expected,
       NULL::jsonb AS data
  FROM lx l
 WHERE NOT EXISTS (SELECT 1 FROM n WHERE n.legacy_id = l.lid)
UNION ALL
SELECT 'diff', 'cell_extra', n.legacy_id, n.id::text,
       CASE WHEN n.deleted_at IS NOT NULL THEN 'excluída no novo' END, NULL, NULL
  FROM n
 WHERE NOT EXISTS (SELECT 1 FROM legacy."Cells" c WHERE c."Id" = n.legacy_id)
UNION ALL
SELECT 'diff', 'cell_status', p.lid, NULL,
       concat_ws('; ',
         CASE WHEN p.del <> p.n_del THEN format('excluída: legado %s, novo %s',
           CASE WHEN p.del THEN 'sim' ELSE 'não' END, CASE WHEN p.n_del THEN 'sim' ELSE 'não' END) END,
         CASE WHEN NOT p.n_active THEN 'inativa no novo' END),
       NULL, NULL
  FROM p
 WHERE p.del <> p.n_del OR NOT p.n_active
UNION ALL
SELECT 'diff', 'cell_field', p.lid, NULL,
       'campo: ' || f.field || coalesce(' (' || f.info || ')', ''), NULL, NULL
  FROM p
 CROSS JOIN LATERAL (VALUES
    ('líder', p.leader_lid::text, p.n_leader_lid::text, format('legado %s, novo %s', p.leader_lid, coalesce(p.n_leader_lid::text, '—'))),
    ('timóteo', p.timothy_lid::text, p.n_timothy_lid::text, format('legado %s, novo %s', p.timothy_lid, coalesce(p.n_timothy_lid::text, '—'))),
    ('anfitrião', p.host_lid::text, p.n_host_lid::text, format('legado %s, novo %s', p.host_lid, coalesce(p.n_host_lid::text, '—'))),
    ('dia', p.meeting_day, p.n_day, NULL),
    ('horário', p.meeting_time::text, p.n_time::text, NULL),
    ('tipo', p.type, p.n_type, NULL),
    ('endereço', p.address, p.n_address, NULL)
 ) f(field, lv, nv, info)
 WHERE f.lv IS DISTINCT FROM f.nv
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', c.n)
  FROM (VALUES ('cell_missing', (SELECT count(*) FROM lx)),
               ('cell_extra', (SELECT count(*) FROM n)),
               ('cell_status', (SELECT count(*) FROM p)),
               ('cell_field', (SELECT count(*) FROM p))) c(code, n)
ORDER BY 1, 2, 3, 4, 5;
