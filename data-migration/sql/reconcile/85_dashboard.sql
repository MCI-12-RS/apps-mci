-- =============================================================================
-- E4.09: números do painel da igreja toda na semana de referência (5.6, Dashboard), legado ×
-- novo, para a conferência lado a lado do E5.04 (informativo: as diferenças por registro já
-- estão nas outras verificações; aqui entram também os cadastros só do novo).
-- Semana de domingo a sábado do instante de referência, no horário de Brasília.
-- =============================================================================
WITH /*BASE*/,
ref AS (SELECT public.week_start(public.sp_local(cfg.at)::date) AS ws FROM cfg),
v AS (
  SELECT 1 AS ord, 'Relatórios enviados na semana' AS label,
         (SELECT count(*) FROM legacy."Reports" r, ref
           WHERE NOT coalesce(r."IsDeleted", false) AND r."Date" IS NOT NULL AND public.week_start(r."Date"::date) = ref.ws) AS legacy,
         (SELECT count(*) FROM public.cell_reports r, ref
           WHERE r.deleted_at IS NULL AND public.week_start(r.date) = ref.ws) AS new
  UNION ALL
  SELECT 2, 'Visitantes na semana',
         (SELECT coalesce(sum(r."NumVisitors"), 0) FROM legacy."Reports" r, ref
           WHERE NOT coalesce(r."IsDeleted", false) AND r."Date" IS NOT NULL AND public.week_start(r."Date"::date) = ref.ws),
         (SELECT coalesce(sum(cardinality(r.visitors)), 0) FROM public.cell_reports r, ref
           WHERE r.deleted_at IS NULL AND public.week_start(r.date) = ref.ws)
  UNION ALL
  SELECT 3, 'Novos membros na semana',
         (SELECT count(*) FROM legacy."Members" x, ref
           WHERE NOT coalesce(x."IsDeleted", false) AND x."CreationDate" IS NOT NULL AND public.week_start(x."CreationDate"::date) = ref.ws),
         (SELECT count(*) FROM public.members m, ref
           WHERE m.deleted_at IS NULL AND m.created_at IS NOT NULL AND public.week_start(public.sp_local(m.created_at)::date) = ref.ws)
  UNION ALL
  SELECT 4, 'Novas células na semana',
         (SELECT count(*) FROM legacy."Cells" c, ref
           WHERE NOT coalesce(c."IsDeleted", false) AND c."CreationDate" IS NOT NULL AND public.week_start(c."CreationDate"::date) = ref.ws),
         (SELECT count(*) FROM public.cells c, ref
           WHERE c.deleted_at IS NULL AND c.created_at IS NOT NULL AND public.week_start(public.sp_local(c.created_at)::date) = ref.ws)
  UNION ALL
  SELECT 5, 'Membros ativos',
         (SELECT count(*) FROM legacy."Members" x WHERE NOT coalesce(x."IsDeleted", false) AND NOT coalesce(x."Idle", false)),
         (SELECT count(*) FROM public.members m WHERE m.deleted_at IS NULL AND m.is_active)
  UNION ALL
  SELECT 6, 'Membros inativos',
         (SELECT count(*) FROM legacy."Members" x WHERE NOT coalesce(x."IsDeleted", false) AND coalesce(x."Idle", false)),
         (SELECT count(*) FROM public.members m WHERE m.deleted_at IS NULL AND NOT m.is_active)
  UNION ALL
  SELECT 7, 'Não batizados (ativos)',
         (SELECT count(*) FROM legacy."Members" x
           WHERE NOT coalesce(x."IsDeleted", false) AND NOT coalesce(x."Idle", false) AND NOT coalesce(x."Baptized", false)),
         (SELECT count(*) FROM public.members m WHERE m.deleted_at IS NULL AND m.is_active AND NOT m.is_baptized)
  UNION ALL
  SELECT 8, 'Células evangelísticas',
         (SELECT count(*) FROM legacy."Cells" c WHERE NOT coalesce(c."IsDeleted", false) AND c."CellType" = 0),
         (SELECT count(*) FROM public.cells c WHERE c.deleted_at IS NULL AND c.is_active AND c.type = 'Evangelística')
  UNION ALL
  SELECT 9, 'Células de discipulado',
         (SELECT count(*) FROM legacy."Cells" c WHERE NOT coalesce(c."IsDeleted", false) AND c."CellType" = 1),
         (SELECT count(*) FROM public.cells c WHERE c.deleted_at IS NULL AND c.is_active AND c.type = 'Discipulado')
  UNION ALL
  SELECT 10, 'Macrocélulas',
         (SELECT count(*) FROM legacy."Cells" c WHERE NOT coalesce(c."IsDeleted", false) AND c."CellType" = 2),
         (SELECT count(*) FROM public.cells c WHERE c.deleted_at IS NULL AND c.is_active AND c.type = 'Macrocélula')
)
SELECT 'metric'::text AS kind, 'dashboard'::text AS code, NULL::bigint AS lid, lpad(v.ord::text, 2, '0') AS ref,
       NULL::text AS detail, NULL::text AS expected,
       jsonb_build_object('label', v.label, 'legacy', v.legacy, 'new', v.new, 'ok', NULL) AS data
  FROM v
ORDER BY 4;
