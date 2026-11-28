-- =============================================================================
-- E4.09: soma das ofertas por mês (5.6, Relatórios).
-- Uma linha metric "offering_month" por mês da data do relatório (horário de Brasília, como
-- o legado grava): no legado, os não excluídos; fora da carga (esperada, o motivo está em
-- report_missing); duplicados da semana (os duplicados reais no legado que a carga listou, pela
-- condição do report_status, DT-08); no novo, os carregados não
-- excluídos. ok = legado - fora - duplicados = novo.
-- =============================================================================
WITH /*BASE*/,
lr AS (SELECT b.month, b.offering, b.del, b.loaded, b.dup FROM lrep b),
nr AS (
  SELECT to_char(r.date, 'YYYY-MM') AS month, r.offering
    FROM public.cell_reports r
   WHERE r.legacy_id IS NOT NULL AND r.deleted_at IS NULL
),
months AS (SELECT month FROM lr WHERE NOT del UNION SELECT month FROM nr),
s AS (
  SELECT m.month,
         coalesce((SELECT sum(offering) FROM lr WHERE lr.month = m.month AND NOT lr.del), 0) AS legacy,
         coalesce((SELECT sum(offering) FROM lr WHERE lr.month = m.month AND NOT lr.del AND NOT lr.loaded), 0) AS left_out,
         coalesce((SELECT sum(offering) FROM lr WHERE lr.month = m.month AND lr.dup), 0) AS dup,
         coalesce((SELECT sum(offering) FROM nr WHERE nr.month = m.month), 0) AS new
    FROM months m
)
SELECT 'metric'::text AS kind, 'offering_month'::text AS code, NULL::bigint AS lid, s.month AS ref,
       NULL::text AS detail, NULL::text AS expected,
       jsonb_build_object('month', s.month, 'legacy', s.legacy, 'left_out', s.left_out, 'duplicates', s.dup,
                          'expected', s.legacy - s.left_out - s.dup, 'new', s.new,
                          'ok', s.legacy - s.left_out - s.dup = s.new) AS data
  FROM s
ORDER BY 4;
