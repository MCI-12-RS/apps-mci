-- =============================================================================
-- E4.09: relatórios e participantes, um a um, pelo legacy_id (5.6, Relatórios).
--   report_missing        no legado e não no novo (esperada: célula inexistente ou de fora, sem
--                         data, oferta fora da faixa; PR2-2, DT-12)
--   report_extra          no novo com um Id que o legado não tem
--   report_status         excluído diferente (esperada: duplicado na semana, que vai excluído
--                         pelo sistema, DT-08)
--   report_field          célula, data, horário, realizado, tema, observações, motivo, visitantes,
--                         oferta
--   report_snapshot       retrato diferente do legado (esperada: pessoa ou tipo do legado
--                         inexistente, de fora ou inválido, completado pela célula; Q-E4-8)
--   report_snapshot_invalid  retrato com pessoa que não existe ou tipo fora da lista
--   participant_missing   par do legado que não está no novo (esperada: membro ou relatório de fora)
--   participant_extra     par do novo que o legado não tem
--   report_participants_count  participantes do novo = NumMembers (esperada: o próprio legado
--                         diverge de ReportMembers, ou participante de fora)
--   report_visitors_count visitantes do novo = NumVisitors (esperada: o próprio legado diverge dos
--                         nomes que ele guarda)
-- =============================================================================
WITH /*BASE*/,
n AS (SELECT r.* FROM public.cell_reports r WHERE r.legacy_id IS NOT NULL),
lx AS (
  SELECT r."Id" AS lid, coalesce(r."IsDeleted", false) AS del, r."CellId" AS cell_lid,
         r."Date" IS NULL AS no_date,
         r."Date"::date AS date, date_trunc('second', r."Date")::time AS time,
         NOT coalesce(r."WeekCellSkipped", false) AS was_held,
         CASE WHEN NOT coalesce(r."WeekCellSkipped", false) AND NOT r."Subject" ~ '^[[:space:]]*$' THEN r."Subject" END AS theme,
         CASE WHEN NOT coalesce(r."WeekCellSkipped", false) AND NOT r."Notes" ~ '^[[:space:]]*$' THEN r."Notes" END AS observations,
         CASE WHEN coalesce(r."WeekCellSkipped", false) AND NOT r."Notes" ~ '^[[:space:]]*$' THEN r."Notes" END AS reason_not_held,
         ARRAY(SELECT t.name
                 FROM regexp_split_to_table(coalesce(r."Visitors", ''), '\|') WITH ORDINALITY v(s, o)
                CROSS JOIN LATERAL (SELECT regexp_replace(v.s, '^[[:space:] ]+|[[:space:] ]+$', '', 'g') AS name) t
                WHERE t.name <> '' ORDER BY v.o) AS visitors,
         round(r."Contribution", 2) AS offering,
         r."NumMembers" AS num_members, r."NumVisitors" AS num_visitors,
         r."LeadershipId" AS s_leader_lid, r."TimothyId" AS s_timothy_lid, r."HostId" AS s_host_lid,
         CASE r."CellType" WHEN 0 THEN 'Evangelística' WHEN 1 THEN 'Discipulado' WHEN 2 THEN 'Macrocélula' END AS s_type,
         EXISTS (SELECT 1 FROM legacy."Cells" c WHERE c."Id" = r."CellId") AS cell_exists,
         EXISTS (SELECT 1 FROM public.cells c WHERE c.legacy_id = r."CellId") AS cell_loaded
    FROM legacy."Reports" r
),
p AS (
  SELECT l.*, n.id AS nid, n.deleted_at IS NOT NULL AS n_del, n.deleted_by_kind AS n_del_kind,
         nc.legacy_id AS n_cell_lid, n.date AS n_date, n.time AS n_time, n.was_held AS n_held, n.theme AS n_theme,
         n.observations AS n_obs, n.reason_not_held AS n_reason, n.visitors AS n_visitors, n.offering AS n_offering,
         ml.lid AS n_s_leader_lid, mt.lid AS n_s_timothy_lid, mh.lid AS n_s_host_lid, n.snapshot_cell_type AS n_s_type,
         n.snapshot_leader_id, n.snapshot_timothy_id, n.snapshot_host_id,
         nc.leader_id AS c_leader, nc.timothy_id AS c_timothy, nc.host_id AS c_host, nc.type AS c_type
    FROM lx l
    JOIN n ON n.legacy_id = l.lid
    LEFT JOIN public.cells nc ON nc.id = n.cell_id
    LEFT JOIN idmap ml ON ml.id = n.snapshot_leader_id
    LEFT JOIN idmap mt ON mt.id = n.snapshot_timothy_id
    LEFT JOIN idmap mh ON mh.id = n.snapshot_host_id
),
-- Pares do legado e do novo, pelos Ids do legado.
lp AS (
  SELECT rm."ReportId" AS report_lid, rm."MemberId" AS member_lid,
         EXISTS (SELECT 1 FROM public.cell_reports x WHERE x.legacy_id = rm."ReportId") AS report_loaded,
         EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = rm."MemberId") AS member_loaded
    FROM legacy."ReportMembers" rm
),
np AS (
  SELECT n.legacy_id AS report_lid, m.lid AS member_lid, cp.member_id
    FROM public.cell_report_participants cp
    JOIN n ON n.id = cp.report_id
    LEFT JOIN idmap m ON m.id = cp.member_id
),
npc AS (SELECT np.report_lid, count(*) AS n FROM np GROUP BY np.report_lid),
lpc AS (
  SELECT lp.report_lid, count(*) AS n, count(*) FILTER (WHERE lp.member_loaded) AS loadable
    FROM lp GROUP BY lp.report_lid
),
pc AS (
  SELECT p.lid, p.num_members,
         coalesce(npc.n, 0) AS n_count, coalesce(lpc.n, 0) AS l_count, coalesce(lpc.loadable, 0) AS l_loadable,
         p.num_visitors, cardinality(p.visitors) AS l_visitors, cardinality(p.n_visitors) AS n_visitors
    FROM p
    LEFT JOIN npc ON npc.report_lid = p.lid
    LEFT JOIN lpc ON lpc.report_lid = p.lid
)
SELECT 'diff'::text AS kind, 'report_missing'::text AS code, l.lid::bigint AS lid, NULL::text AS ref,
       concat_ws('; ', 'célula: ' || coalesce(l.cell_lid::text, '—'), CASE WHEN l.del THEN 'excluído no legado' END) AS detail,
       nullif(concat_ws(',',
         CASE WHEN NOT l.cell_exists THEN 'report_cell_missing' END,
         CASE WHEN l.cell_exists AND NOT l.cell_loaded THEN 'report_cell_left_out' END,
         CASE WHEN l.no_date THEN 'report_date_missing' END,
         CASE WHEN l.offering < 0 OR l.offering > 999999.99 THEN 'report_offering_out_of_range' END
       ), '') AS expected,
       NULL::jsonb AS data
  FROM lx l
 WHERE NOT EXISTS (SELECT 1 FROM n WHERE n.legacy_id = l.lid)
UNION ALL
SELECT 'diff', 'report_extra', n.legacy_id, n.id::text,
       CASE WHEN n.deleted_at IS NOT NULL THEN 'excluído no novo' END, NULL, NULL
  FROM n
 WHERE NOT EXISTS (SELECT 1 FROM legacy."Reports" r WHERE r."Id" = n.legacy_id)
UNION ALL
SELECT 'diff', 'report_status', p.lid, NULL,
       format('excluído: legado %s, novo %s%s', CASE WHEN p.del THEN 'sim' ELSE 'não' END,
              CASE WHEN p.n_del THEN 'sim' ELSE 'não' END,
              CASE WHEN p.n_del AND p.n_del_kind = 'system' THEN ' (pelo sistema)' ELSE '' END),
       CASE WHEN NOT p.del AND p.n_del AND p.n_del_kind = 'system'
             AND EXISTS (SELECT 1 FROM p k
                          WHERE k.cell_lid = p.cell_lid AND NOT k.del AND k.lid > p.lid
                            AND public.week_start(k.date) = public.week_start(p.date))
            THEN 'report_duplicate_week' END,
       NULL
  FROM p
 WHERE p.del <> p.n_del
UNION ALL
SELECT 'diff', 'report_field', p.lid, NULL, 'campo: ' || f.field || coalesce(' (' || f.info || ')', ''), NULL, NULL
  FROM p
 CROSS JOIN LATERAL (VALUES
    ('célula', p.cell_lid::text, p.n_cell_lid::text, format('legado %s, novo %s', p.cell_lid, coalesce(p.n_cell_lid::text, '—'))),
    ('data', p.date::text, p.n_date::text, NULL),
    ('horário', p.time::text, p.n_time::text, NULL),
    ('realizada', p.was_held::text, p.n_held::text, NULL),
    ('tema', p.theme, p.n_theme, NULL),
    ('observações', p.observations, p.n_obs, NULL),
    ('motivo', p.reason_not_held, p.n_reason, NULL),
    ('visitantes', p.visitors::text, coalesce(p.n_visitors, '{}')::text, NULL),
    ('oferta', p.offering::text, p.n_offering::text, NULL)
 ) f(field, lv, nv, info)
 WHERE f.lv IS DISTINCT FROM f.nv
UNION ALL
SELECT 'diff', 'report_snapshot', p.lid, NULL, 'retrato: ' || f.field || ' (' || f.info || ')',
       CASE WHEN f.from_cell THEN 'report_snapshot_from_cell' END, NULL
  FROM p
 CROSS JOIN LATERAL (VALUES
    ('líder', p.s_leader_lid::text, p.n_s_leader_lid::text,
     format('legado %s, novo %s', p.s_leader_lid, coalesce(p.n_s_leader_lid::text, '—')),
     NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = p.s_leader_lid) AND p.snapshot_leader_id = p.c_leader),
    ('timóteo', p.s_timothy_lid::text, p.n_s_timothy_lid::text,
     format('legado %s, novo %s', p.s_timothy_lid, coalesce(p.n_s_timothy_lid::text, '—')),
     NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = p.s_timothy_lid) AND p.snapshot_timothy_id = p.c_timothy),
    ('anfitrião', p.s_host_lid::text, p.n_s_host_lid::text,
     format('legado %s, novo %s', p.s_host_lid, coalesce(p.n_s_host_lid::text, '—')),
     NOT EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = p.s_host_lid) AND p.snapshot_host_id = p.c_host),
    ('tipo', p.s_type, p.n_s_type, CASE WHEN p.s_type IS NULL THEN 'vazio ou inválido no legado' ELSE 'diferente' END,
     p.s_type IS NULL AND p.n_s_type = p.c_type)
 ) f(field, lv, nv, info, from_cell)
 WHERE f.lv IS DISTINCT FROM f.nv
UNION ALL
SELECT 'diff', 'report_snapshot_invalid', n.legacy_id, NULL,
       concat_ws('; ',
         CASE WHEN NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_leader_id) THEN 'líder' END,
         CASE WHEN NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_timothy_id) THEN 'timóteo' END,
         CASE WHEN NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_host_id) THEN 'anfitrião' END,
         CASE WHEN n.snapshot_cell_type IS NULL OR NOT n.snapshot_cell_type = ANY (public.cell_types()) THEN 'tipo' END),
       NULL, NULL
  FROM n
 WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_leader_id)
    OR NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_timothy_id)
    OR NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = n.snapshot_host_id)
    OR n.snapshot_cell_type IS NULL OR NOT n.snapshot_cell_type = ANY (public.cell_types())
UNION ALL
SELECT 'diff', 'participant_missing', lp.report_lid, 'membro ' || lp.member_lid,
       concat_ws('; ', CASE WHEN NOT lp.report_loaded THEN 'relatório fora da carga' END,
                       CASE WHEN NOT lp.member_loaded THEN 'membro fora da carga' END),
       CASE WHEN NOT lp.report_loaded OR NOT lp.member_loaded THEN 'participant_left_out' END, NULL
  FROM lp
 WHERE NOT EXISTS (SELECT 1 FROM np WHERE np.report_lid = lp.report_lid AND np.member_lid = lp.member_lid)
UNION ALL
SELECT 'diff', 'participant_extra', np.report_lid,
       CASE WHEN np.member_lid IS NULL THEN 'cadastro só do novo ' || np.member_id ELSE 'membro ' || np.member_lid END,
       NULL, NULL, NULL
  FROM np
 WHERE np.member_lid IS NULL
    OR NOT EXISTS (SELECT 1 FROM legacy."ReportMembers" rm WHERE rm."ReportId" = np.report_lid AND rm."MemberId" = np.member_lid)
UNION ALL
SELECT 'diff', 'report_participants_count', pc.lid, NULL,
       format('novo %s; NumMembers %s; no legado: %s em ReportMembers, %s carregáveis',
              pc.n_count, coalesce(pc.num_members::text, '—'), pc.l_count, pc.l_loadable),
       CASE WHEN pc.n_count = pc.l_loadable THEN nullif(concat_ws(',',
              CASE WHEN pc.l_count IS DISTINCT FROM pc.num_members::bigint THEN 'legacy_num_members_mismatch' END,
              CASE WHEN pc.l_loadable < pc.l_count THEN 'participant_left_out' END), '') END,
       NULL
  FROM pc
 WHERE pc.n_count IS DISTINCT FROM pc.num_members::bigint
UNION ALL
SELECT 'diff', 'report_visitors_count', pc.lid, NULL,
       format('novo %s; NumVisitors %s; nomes no legado %s', pc.n_visitors, coalesce(pc.num_visitors::text, '—'), pc.l_visitors),
       CASE WHEN pc.n_visitors = pc.l_visitors THEN 'legacy_num_visitors_mismatch' END,
       NULL
  FROM pc
 WHERE pc.n_visitors IS DISTINCT FROM coalesce(pc.num_visitors, 0)
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', c.n)
  FROM (VALUES ('report_missing', (SELECT count(*) FROM lx)),
               ('report_extra', (SELECT count(*) FROM n)),
               ('report_status', (SELECT count(*) FROM p)),
               ('report_field', (SELECT count(*) FROM p)),
               ('report_snapshot', (SELECT count(*) FROM p)),
               ('report_snapshot_invalid', (SELECT count(*) FROM n)),
               ('participant_missing', (SELECT count(*) FROM lp)),
               ('participant_extra', (SELECT count(*) FROM np)),
               ('report_participants_count', (SELECT count(*) FROM p)),
               ('report_visitors_count', (SELECT count(*) FROM p))) c(code, n)
UNION ALL
-- Quantos relatórios ficaram com o tipo do retrato vindo da célula (E2.11).
SELECT 'metric', 'report_snapshot_type_from_cell', NULL, NULL, NULL, NULL,
       jsonb_build_object('n', (SELECT count(*) FROM p WHERE p.s_type IS NULL), 'ok', NULL)
ORDER BY 1, 2, 3, 4, 5;
