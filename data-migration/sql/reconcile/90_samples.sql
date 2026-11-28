-- =============================================================================
-- E4.09: amostra para a conferência manual da liderança (5.6, Amostragem manual): 20 membros,
-- 10 células e 10 relatórios carregados e não excluídos, sorteados por mci.rc_seed (a mesma
-- semente dá a mesma amostra). Só os Ids do legado e o id do novo.
-- =============================================================================
WITH /*BASE*/
(SELECT 'item'::text AS kind, 'sample_member'::text AS code, m.legacy_id::bigint AS lid, m.id::text AS ref,
        NULL::text AS detail, NULL::text AS expected, NULL::jsonb AS data
   FROM public.members m CROSS JOIN cfg
  WHERE m.legacy_id IS NOT NULL AND m.deleted_at IS NULL
  ORDER BY md5(cfg.seed || ':m:' || m.legacy_id) LIMIT 20)
UNION ALL
(SELECT 'item', 'sample_cell', c.legacy_id, c.id::text, NULL, NULL, NULL
   FROM public.cells c CROSS JOIN cfg
  WHERE c.legacy_id IS NOT NULL AND c.deleted_at IS NULL
  ORDER BY md5(cfg.seed || ':c:' || c.legacy_id) LIMIT 10)
UNION ALL
(SELECT 'item', 'sample_report', r.legacy_id, r.id::text, NULL, NULL, NULL
   FROM public.cell_reports r CROSS JOIN cfg
  WHERE r.legacy_id IS NOT NULL AND r.deleted_at IS NULL
  ORDER BY md5(cfg.seed || ':r:' || r.legacy_id) LIMIT 10)
ORDER BY 2, 3;
