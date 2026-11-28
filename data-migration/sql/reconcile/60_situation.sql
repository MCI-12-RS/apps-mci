-- =============================================================================
-- E4.09: situação do relatório numa semana de referência (5.6; RN-10 do E2.09).
-- Para cada célula carregada, ativa e não excluída no novo: "pendente" no novo
-- (private.cell_report_situation, como postgres) × "pendente" no legado (OverDueThisWeek: sem
-- relatório não excluído na semana de domingo a sábado e a reunião + 1 hora já passou, no horário
-- de Brasília), no instante de referência (mci.rc_at).
--   report_situation  a célula difere. Esperadas: a semana não conta no novo (cadastrada, ativada
--                     ou restaurada depois do prazo: "Conta a partir da próxima semana"); o instante
--                     a menos de 1 hora do prazo (a tolerância do legado é aproximada); o relatório
--                     da semana ficou de fora da carga; relatório da semana lançado só no novo.
--   report_situation_counts (metric) o card de pendentes: legado (todas as células com dia e horário
--                     válidos), novo (carregadas) e novo (todas).
-- =============================================================================
WITH /*BASE*/,
ref AS (
  SELECT cfg.at, public.sp_local(cfg.at) AS local, public.week_start(public.sp_local(cfg.at)::date) AS ws FROM cfg
),
lcell AS (
  SELECT c."Id" AS lid,
         (ref.ws + c."WeekDay")::timestamp
           + CASE WHEN btrim(c."Time") ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$' THEN btrim(c."Time")::time END
           + interval '1 hour' AS deadline,
         EXISTS (SELECT 1 FROM legacy."Reports" r
                  WHERE r."CellId" = c."Id" AND NOT coalesce(r."IsDeleted", false) AND r."Date" IS NOT NULL
                    AND public.week_start(r."Date"::date) = ref.ws) AS sent,
         EXISTS (SELECT 1 FROM legacy."Reports" r
                  WHERE r."CellId" = c."Id" AND NOT coalesce(r."IsDeleted", false) AND r."Date" IS NOT NULL
                    AND public.week_start(r."Date"::date) = ref.ws
                    AND NOT EXISTS (SELECT 1 FROM public.cell_reports x WHERE x.legacy_id = r."Id" AND x.deleted_at IS NULL)) AS sent_left_out,
         ref.local
    FROM legacy."Cells" c CROSS JOIN ref
   WHERE NOT coalesce(c."IsDeleted", false) AND c."WeekDay" BETWEEN 0 AND 6
),
lsit AS (
  SELECT l.*, NOT l.sent AND l.deadline IS NOT NULL AND l.deadline <= l.local AS pending FROM lcell l
),
nsit AS (
  SELECT c.id, c.legacy_id AS lid, s.report_status,
         EXISTS (SELECT 1 FROM public.cell_reports r
                  WHERE r.cell_id = c.id AND r.deleted_at IS NULL AND r.legacy_id IS NULL
                    AND public.week_start(r.date) = ref.ws) AS new_only_report
    FROM public.cells c
   CROSS JOIN ref
   CROSS JOIN LATERAL private.cell_report_situation(c.id, c.is_active, c.meeting_day, c.meeting_time, ref.at) s
   WHERE c.is_active AND c.deleted_at IS NULL
),
p AS (
  SELECT n.lid, n.report_status, n.new_only_report, l.pending AS l_pending, l.sent, l.sent_left_out, l.deadline, l.local
    FROM nsit n JOIN lsit l ON l.lid = n.lid
)
SELECT 'diff'::text AS kind, 'report_situation'::text AS code, p.lid::bigint AS lid, NULL::text AS ref,
       format('legado: %s; novo: %s', CASE WHEN p.l_pending THEN 'pendente' WHEN p.sent THEN 'enviado' ELSE 'não pendente' END,
              p.report_status) AS detail,
       nullif(concat_ws(',',
         CASE WHEN p.report_status = 'next_week' THEN 'week_not_counted' END,
         CASE WHEN abs(extract(epoch FROM p.local - p.deadline)) < 3600 THEN 'deadline_tolerance' END,
         CASE WHEN p.sent_left_out AND p.report_status = 'pending' THEN 'report_left_out_week' END,
         CASE WHEN p.new_only_report AND p.l_pending THEN 'report_new_only_week' END
       ), '') AS expected,
       NULL::jsonb AS data
  FROM p
 WHERE p.l_pending <> (p.report_status = 'pending')
UNION ALL
SELECT 'compared', 'report_situation', NULL, NULL, NULL, NULL, jsonb_build_object('n', (SELECT count(*) FROM p))
UNION ALL
SELECT 'metric', 'report_situation_counts', NULL, NULL, NULL, NULL,
       jsonb_build_object('at', (SELECT to_char(local, 'YYYY-MM-DD HH24:MI') FROM ref),
                          'week_start', (SELECT ws FROM ref),
                          'legacy_pending', (SELECT count(*) FROM lsit WHERE pending),
                          'new_pending_loaded', (SELECT count(*) FROM nsit WHERE lid IS NOT NULL AND report_status = 'pending'),
                          'new_pending_all', (SELECT count(*) FROM nsit WHERE report_status = 'pending'),
                          'ok', NULL)
ORDER BY 1, 2, 3, 4, 5;
