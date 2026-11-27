-- =============================================================================
-- E4.06, passo 3: células do legado transformadas (pg_temp.lc) e o mapa delas.
-- Mapeamento: 5.5 (Cells → cells). Nada é gravado aqui.
-- Célula com horário, dia ou tipo inválido, ou sem uma das três pessoas
-- (inexistente, de fora ou excluída numa célula não excluída), fica de fora,
-- com os relatórios e os participantes (DT-12). O legado não tem célula inativa:
-- todas entram ativas (RN-11 do E2.08).
-- =============================================================================

CREATE TEMP TABLE lc ON COMMIT DROP AS
SELECT c."Id" AS lid,
       coalesce(c."IsDeleted", false) AS del,
       c."LeadId" AS leader_lid, c."TimothyId" AS timothy_lid, c."HostId" AS host_lid,
       ml.id AS leader_id, mt.id AS timothy_id, mh.id AS host_id,
       coalesce(ll.del, false) OR coalesce(lt.del, false) OR coalesce(lh.del, false) AS person_deleted,
       (SELECT d FROM unnest(public.cell_weekdays()) d WHERE public.weekday_index(d) = c."WeekDay") AS meeting_day,
       CASE WHEN btrim(c."Time") ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' THEN btrim(c."Time")::time END AS meeting_time,
       CASE c."CellType" WHEN 0 THEN 'Evangelística' WHEN 1 THEN 'Discipulado' WHEN 2 THEN 'Macrocélula' END AS type,
       pg_temp.blank_null(a."Street") AS street,
       pg_temp.blank_null(a."Number") AS number,
       pg_temp.blank_null(a."Notes") AS complement,
       pg_temp.blank_null(a."Neighborhood") AS neighborhood,
       pg_temp.blank_null(a."City") AS city,
       upper(pg_temp.blank_null(btrim(a."State"))) AS state,
       public.normalize_digits(a."PostalCode") AS zip_code,
       c."CreatedBy" AS created_by_raw,
       c."CreationDate" AS created_on,
       c."LastModifiedBy" AS updated_by_raw,
       c."LastModifiedDate" AS updated_on
  FROM legacy."Cells" c
  LEFT JOIN member_map ml ON ml.lid = c."LeadId"
  LEFT JOIN member_map mt ON mt.lid = c."TimothyId"
  LEFT JOIN member_map mh ON mh.lid = c."HostId"
  LEFT JOIN lm ll ON ll.lid = c."LeadId"
  LEFT JOIN lm lt ON lt.lid = c."TimothyId"
  LEFT JOIN lm lh ON lh.lid = c."HostId"
  LEFT JOIN legacy."Addresses" a ON a."Id" = c."PlaceId";

ALTER TABLE lc ADD PRIMARY KEY (lid);

CREATE TEMP TABLE lc_out ON COMMIT DROP AS
SELECT x.code, x.lid, x.info
  FROM (
    SELECT 'cell_time_invalid' AS code, lid, CASE WHEN del THEN 'excluída' END AS info
      FROM lc WHERE meeting_time IS NULL
    UNION ALL
    SELECT 'cell_weekday_invalid', lid, CASE WHEN del THEN 'excluída' END FROM lc WHERE meeting_day IS NULL
    UNION ALL
    SELECT 'cell_type_invalid', lid, CASE WHEN del THEN 'excluída' END FROM lc WHERE type IS NULL
    UNION ALL
    SELECT CASE WHEN del THEN 'cell_deleted_person_missing' ELSE 'cell_person_missing' END, lid,
           concat_ws('; ', CASE WHEN leader_id IS NULL THEN 'líder: ' || coalesce(leader_lid::text, 'vazio') END,
                           CASE WHEN timothy_id IS NULL THEN 'timóteo: ' || coalesce(timothy_lid::text, 'vazio') END,
                           CASE WHEN host_id IS NULL THEN 'anfitrião: ' || coalesce(host_lid::text, 'vazio') END)
      FROM lc WHERE leader_id IS NULL OR timothy_id IS NULL OR host_id IS NULL
    UNION ALL
    SELECT 'cell_person_deleted', lid, NULL FROM lc WHERE NOT del AND person_deleted
  ) x;

INSERT INTO load_issues SELECT code, lid, info FROM lc_out;

CREATE TEMP TABLE cell_map (
  lid integer PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  how text NOT NULL CHECK (how IN ('existing', 'new'))
) ON COMMIT DROP;

INSERT INTO cell_map (lid, id, how)
SELECT l.lid, coalesce(c.id, gen_random_uuid()), CASE WHEN c.id IS NULL THEN 'new' ELSE 'existing' END
  FROM lc l LEFT JOIN public.cells c ON c.legacy_id = l.lid
 WHERE NOT EXISTS (SELECT 1 FROM lc_out o WHERE o.lid = l.lid);

INSERT INTO load_issues
SELECT 'cell_stale', c.legacy_id, CASE WHEN l.lid IS NULL THEN 'não existe no legado' ELSE 'ficou de fora' END
  FROM public.cells c LEFT JOIN lc l ON l.lid = c.legacy_id
 WHERE c.legacy_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cell_map cm WHERE cm.lid = c.legacy_id);
