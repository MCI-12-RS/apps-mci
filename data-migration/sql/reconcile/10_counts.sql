-- =============================================================================
-- E4.09: contagens por entidade e situação (5.6, Contagens).
-- Uma linha metric "counts" por entidade e situação: no legado, fora da carga (sem linha no
-- novo; o motivo de cada um está em *_missing), duplicados da semana (os duplicados reais no
-- legado que a carga listou, que vão excluídos pelo sistema, DT-08), o esperado no novo e o que
-- está no novo (só o que tem legacy_id; o que não tem é contado em 15_new_only).
-- ok = esperado igual ao novo.
-- =============================================================================
WITH /*BASE*/,
lm AS (
  SELECT CASE WHEN b.del THEN 'excluídos' WHEN b.active THEN 'ativos' ELSE 'inativos' END AS sit,
         EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = b.lid) AS loaded
    FROM lmb b
),
nm AS (
  SELECT CASE WHEN m.deleted_at IS NOT NULL THEN 'excluídos' WHEN m.is_active THEN 'ativos' ELSE 'inativos' END AS sit
    FROM public.members m WHERE m.legacy_id IS NOT NULL
),
lc AS (
  SELECT CASE WHEN coalesce(c."IsDeleted", false) THEN 'excluídas' ELSE 'ativas' END AS sit,
         EXISTS (SELECT 1 FROM public.cells x WHERE x.legacy_id = c."Id") AS loaded
    FROM legacy."Cells" c
),
nc AS (
  SELECT CASE WHEN c.deleted_at IS NOT NULL THEN 'excluídas' WHEN c.is_active THEN 'ativas' ELSE 'inativas' END AS sit
    FROM public.cells c WHERE c.legacy_id IS NOT NULL
),
lr AS (
  -- Duplicado da semana (DT-08): o duplicado real no legado que a carga listou (lrep.dup), pela
  -- mesma condição do report_status; nunca "qualquer excluído pelo sistema no novo".
  SELECT CASE WHEN b.del THEN 'excluídos' ELSE 'não excluídos' END AS sit, b.loaded, b.dup
    FROM lrep b
),
nr AS (
  SELECT CASE WHEN r.deleted_at IS NOT NULL THEN 'excluídos' ELSE 'não excluídos' END AS sit
    FROM public.cell_reports r WHERE r.legacy_id IS NOT NULL
),
lp AS (
  SELECT EXISTS (SELECT 1 FROM public.cell_reports x WHERE x.legacy_id = rm."ReportId")
         AND EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = rm."MemberId") AS loaded
    FROM legacy."ReportMembers" rm
),
rows AS (
  SELECT 1 AS ord, 'Membros' AS entity, s.sit,
         (SELECT count(*) FROM lm WHERE lm.sit = s.sit) AS legacy,
         (SELECT count(*) FROM lm WHERE lm.sit = s.sit AND NOT lm.loaded) AS left_out,
         0::bigint AS dup_out, 0::bigint AS dup_in,
         (SELECT count(*) FROM nm WHERE nm.sit = s.sit) AS new
    FROM (VALUES ('ativos'), ('inativos'), ('excluídos')) s(sit)
  UNION ALL
  SELECT 2, 'Células', s.sit,
         (SELECT count(*) FROM lc WHERE lc.sit = s.sit),
         (SELECT count(*) FROM lc WHERE lc.sit = s.sit AND NOT lc.loaded),
         0, 0,
         (SELECT count(*) FROM nc WHERE nc.sit = s.sit)
    FROM (VALUES ('ativas'), ('inativas'), ('excluídas')) s(sit)
  UNION ALL
  SELECT 3, 'Relatórios', s.sit,
         (SELECT count(*) FROM lr WHERE lr.sit = s.sit),
         (SELECT count(*) FROM lr WHERE lr.sit = s.sit AND NOT lr.loaded),
         CASE WHEN s.sit = 'não excluídos' THEN (SELECT count(*) FROM lr WHERE lr.dup) ELSE 0 END,
         CASE WHEN s.sit = 'excluídos' THEN (SELECT count(*) FROM lr WHERE lr.dup) ELSE 0 END,
         (SELECT count(*) FROM nr WHERE nr.sit = s.sit)
    FROM (VALUES ('não excluídos'), ('excluídos')) s(sit)
  UNION ALL
  SELECT 4, 'Participantes', 'todos',
         (SELECT count(*) FROM lp), (SELECT count(*) FROM lp WHERE NOT lp.loaded), 0, 0,
         (SELECT count(*) FROM public.cell_report_participants cp
            JOIN public.cell_reports r ON r.id = cp.report_id WHERE r.legacy_id IS NOT NULL)
)
SELECT 'metric'::text AS kind, 'counts'::text AS code, NULL::bigint AS lid,
       r.ord || ':' || r.entity || ':' || r.sit AS ref, NULL::text AS detail, NULL::text AS expected,
       jsonb_build_object('entity', r.entity, 'situation', r.sit, 'legacy', r.legacy, 'left_out', r.left_out,
                          'duplicates', r.dup_out + r.dup_in,
                          'expected', r.legacy - r.left_out - r.dup_out + r.dup_in, 'new', r.new,
                          'ok', r.legacy - r.left_out - r.dup_out + r.dup_in = r.new) AS data
  FROM rows r
ORDER BY 4;
