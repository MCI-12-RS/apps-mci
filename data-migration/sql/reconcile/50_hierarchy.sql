-- =============================================================================
-- E4.09: hierarquia (5.6, Hierarquia e Totais; RN-13 do E2.06).
--   leader_cycle        ciclo de liderança no novo (todos os não excluídos)
--   spouse_reciprocal   cônjuge não recíproco ou excluído no novo (todos os não excluídos)
--   member_level        12 ^ g12_level (no máximo 12^6) = MinistryLevel; "sem liderança" = 9999999.
--                       Esperadas: sem líder e sem "não tem liderança" fora dos pastores da D9 (o legado
--                       os mostra como Pastores: 1), "sem topo" (líder excluído acima), o líder desfeito
--                       pela carga acima ou no próprio membro, e o MinistryLevel vazio no legado
--   member_totals       discípulos e células (total, masculinas, femininas) recalculados a partir do
--                       líder de cada membro no legado, sem inativos (D2) e sem excluídos, e comparados
--                       com private.member_hierarchy; esperada: só o que vem de cadastros e células do
--                       novo (sem legacy_id)
--   ranking_g12, cells_by_gender (metric)
-- A árvore do legado usa o líder do legado, menos onde o novo ficou sem líder (desfeito pela carga;
-- se não era esperado, member_leader já falha). O "sem topo" conta só as próprias células, como no novo.
-- =============================================================================
WITH RECURSIVE /*BASE*/,
live AS (SELECT m.id, m.leader_id FROM public.members m WHERE m.deleted_at IS NULL),
notop AS (SELECT p.member_id AS id FROM private.member_hierarchy_problems() p WHERE p.problem = 'no_top'),
walk (origin, cur, path) AS (
  SELECT l.id, l.leader_id, ARRAY[l.id] FROM live l JOIN notop t ON t.id = l.id WHERE l.leader_id IS NOT NULL
  UNION ALL
  SELECT w.origin, l.leader_id, w.path || l.id
    FROM walk w JOIN live l ON l.id = w.cur
   WHERE l.leader_id IS NOT NULL AND NOT l.id = ANY (w.path)
),
cycle_members AS (SELECT DISTINCT w.origin AS id FROM walk w WHERE w.cur = w.origin),
-- Membros do legado que o novo deixou sem líder (pela carga).
nulled AS (
  SELECT m.id FROM public.members m JOIN lmb b ON b.lid = m.legacy_id
   WHERE m.leader_id IS NULL AND b.leader_raw IS NOT NULL
),
nulled_arr AS (SELECT coalesce(array_agg(id), '{}') AS ids FROM nulled),
lvl AS (
  SELECT m.legacy_id AS lid, m.id, m.leader_id, m.is_pastor, h.g12_level, h.ancestor_ids, b.ministry_level, b.no_leadership,
         CASE WHEN h.g12_level IS NULL THEN 9999999 ELSE (12 ^ least(h.g12_level, 6))::bigint END AS exp_level
    FROM public.members m
    JOIN private.member_hierarchy h ON h.member_id = m.id
    JOIN lmb b ON b.lid = m.legacy_id
   WHERE m.legacy_id IS NOT NULL AND m.deleted_at IS NULL
),
-- Árvore do legado (Ids do legado): carregados, não excluídos no legado.
lt AS (
  SELECT b.lid, b.active, b.gender,
         CASE WHEN m.leader_id IS NULL AND b.leader_raw IS NOT NULL THEN NULL ELSE b.leader_raw END AS eff_leader
    FROM lmb b JOIN public.members m ON m.legacy_id = b.lid
   WHERE NOT b.del
),
ltree (lid, anc) AS (
  SELECT lt.lid, '{}'::int[] FROM lt WHERE lt.eff_leader IS NULL
  UNION ALL
  SELECT c.lid, t.anc || t.lid FROM ltree t JOIN lt c ON c.eff_leader = t.lid
),
ldisc AS (
  SELECT a AS lid, count(*) AS n
    FROM ltree t JOIN lt ON lt.lid = t.lid, unnest(t.anc) a
   WHERE lt.active
   GROUP BY a
),
-- Células do legado carregadas e não excluídas, pelo líder: para ele e para os de cima
-- (o "sem topo", fora da árvore, conta só as próprias).
lcell AS (
  SELECT c."Id" AS cell_lid, l.lid AS leader_lid, l.gender, coalesce(t.anc, '{}') AS anc, t.lid IS NOT NULL AS resolved
    FROM legacy."Cells" c
    JOIN public.cells x ON x.legacy_id = c."Id"
    JOIN lt l ON l.lid = c."LeadId"
    LEFT JOIN ltree t ON t.lid = l.lid
   WHERE NOT coalesce(c."IsDeleted", false)
),
lcel AS (
  SELECT o AS lid, count(*) AS total, count(*) FILTER (WHERE c.gender = 'M') AS male,
         count(*) FILTER (WHERE c.gender = 'F') AS female
    FROM lcell c, unnest(c.anc || c.leader_lid) o
   GROUP BY o
),
-- O que vem do novo (cadastros e células sem legacy_id).
nn_disc AS (
  SELECT a AS id, count(*) AS n
    FROM public.members m JOIN private.member_hierarchy h ON h.member_id = m.id, unnest(h.ancestor_ids) a
   WHERE m.legacy_id IS NULL AND m.deleted_at IS NULL AND m.is_active
   GROUP BY a
),
nn_cel AS (
  SELECT o AS id, count(*) AS total, count(*) FILTER (WHERE l.gender = 'M') AS male,
         count(*) FILTER (WHERE l.gender = 'F') AS female
    FROM public.cells c
    JOIN public.members l ON l.id = c.leader_id AND l.deleted_at IS NULL
    JOIN private.member_hierarchy h ON h.member_id = l.id, unnest(h.ancestor_ids || l.id) o
   WHERE c.legacy_id IS NULL AND c.is_active AND c.deleted_at IS NULL
   GROUP BY o
),
tot AS (
  SELECT m.legacy_id AS lid, h.total_disciples AS s_disc, h.total_cells AS s_cells, h.male_cells AS s_male,
         h.female_cells AS s_female,
         coalesce(d.n, 0) AS l_disc, coalesce(c.total, 0) AS l_cells, coalesce(c.male, 0) AS l_male,
         coalesce(c.female, 0) AS l_female,
         coalesce(nd.n, 0) AS n_disc, coalesce(nc.total, 0) AS n_cells, coalesce(nc.male, 0) AS n_male,
         coalesce(nc.female, 0) AS n_female
    FROM public.members m
    JOIN private.member_hierarchy h ON h.member_id = m.id
    JOIN lt ON lt.lid = m.legacy_id
    LEFT JOIN ldisc d ON d.lid = m.legacy_id
    LEFT JOIN lcel c ON c.lid = m.legacy_id
    LEFT JOIN nn_disc nd ON nd.id = m.id
    LEFT JOIN nn_cel nc ON nc.id = m.id
   WHERE m.deleted_at IS NULL
)
SELECT 'diff'::text AS kind, 'leader_cycle'::text AS code, m.legacy_id::bigint AS lid,
       CASE WHEN m.legacy_id IS NULL THEN 'cadastro só do novo ' || m.id END AS ref, NULL::text AS detail,
       NULL::text AS expected, NULL::jsonb AS data
  FROM cycle_members c JOIN public.members m ON m.id = c.id
UNION ALL
SELECT 'diff', 'spouse_reciprocal', m.legacy_id, CASE WHEN m.legacy_id IS NULL THEN 'cadastro só do novo ' || m.id END,
       CASE WHEN s.id IS NULL THEN 'o cônjuge não existe'
            WHEN s.deleted_at IS NOT NULL THEN 'o cônjuge está excluído'
            ELSE 'o cônjuge aponta para ' || coalesce('o Id ' || sl.legacy_id, CASE WHEN s.spouse_id IS NULL THEN 'ninguém' ELSE 'outro cadastro' END)
       END,
       NULL, NULL
  FROM public.members m
  LEFT JOIN public.members s ON s.id = m.spouse_id
  LEFT JOIN public.members sl ON sl.id = s.spouse_id
 WHERE m.deleted_at IS NULL AND m.spouse_id IS NOT NULL
   AND (s.id IS NULL OR s.deleted_at IS NOT NULL OR s.spouse_id IS DISTINCT FROM m.id)
UNION ALL
SELECT 'diff', 'member_level', v.lid, NULL,
       format('nível: legado %s, esperado %s (g12_level %s)', coalesce(v.ministry_level::text, 'vazio'), v.exp_level,
              coalesce(v.g12_level::text, 'nulo')),
       nullif(concat_ws(',',
         CASE WHEN v.ministry_level IS NULL THEN 'legacy_level_missing' END,
         CASE WHEN v.leader_id IS NULL AND NOT v.is_pastor AND NOT v.no_leadership AND v.ministry_level = 1
              THEN 'member_no_leader_not_marked' END,
         CASE WHEN EXISTS (SELECT 1 FROM notop t WHERE t.id = v.id) THEN 'level_no_top' END,
         CASE WHEN v.id = ANY (na.ids) OR v.ancestor_ids && na.ids THEN 'level_follows_leader_change' END
       ), ''),
       NULL
  FROM lvl v CROSS JOIN nulled_arr na
 WHERE v.exp_level IS DISTINCT FROM v.ministry_level::bigint
UNION ALL
SELECT 'diff', 'member_totals', t.lid, NULL,
       concat_ws('; ',
         CASE WHEN t.s_disc <> t.l_disc THEN format('discípulos: novo %s, legado %s (do novo: %s)', t.s_disc, t.l_disc, t.n_disc) END,
         CASE WHEN t.s_cells <> t.l_cells THEN format('células: novo %s, legado %s (do novo: %s)', t.s_cells, t.l_cells, t.n_cells) END,
         CASE WHEN t.s_male <> t.l_male THEN format('masculinas: novo %s, legado %s (do novo: %s)', t.s_male, t.l_male, t.n_male) END,
         CASE WHEN t.s_female <> t.l_female THEN format('femininas: novo %s, legado %s (do novo: %s)', t.s_female, t.l_female, t.n_female) END),
       CASE WHEN (t.s_disc - t.n_disc, t.s_cells - t.n_cells, t.s_male - t.n_male, t.s_female - t.n_female)
                 = (t.l_disc, t.l_cells, t.l_male, t.l_female) THEN 'total_new_records' END,
       NULL
  FROM tot t
 WHERE (t.s_disc, t.s_cells, t.s_male, t.s_female) <> (t.l_disc, t.l_cells, t.l_male, t.l_female)
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', c.n)
  FROM (VALUES ('leader_cycle', (SELECT count(*) FROM live)),
               ('spouse_reciprocal', (SELECT count(*) FROM live)),
               ('member_level', (SELECT count(*) FROM lvl)),
               ('member_totals', (SELECT count(*) FROM tot))) c(code, n)
UNION ALL
-- Ranking G12 (5.6): a soma de total_cells dos G12 = as células ativas sob os G12; do legado, as
-- carregadas sob um G12 na árvore do legado, mais as do novo.
SELECT 'metric', 'ranking_g12', NULL, NULL, NULL, NULL,
       jsonb_build_object('g12_sum', x.g12_sum, 'cells_under_g12', x.cells_under, 'legacy_cells_under_g12', x.legacy_under,
                          'new_only_cells_under_g12', x.new_only_under,
                          'ok', x.g12_sum = x.cells_under AND x.legacy_under + x.new_only_under = x.cells_under)
  FROM (SELECT
          (SELECT coalesce(sum(h.total_cells), 0) FROM public.members m JOIN private.member_hierarchy h ON h.member_id = m.id
            WHERE m.deleted_at IS NULL AND h.g12_level = 1) AS g12_sum,
          (SELECT count(*) FROM public.cells c JOIN private.member_hierarchy h ON h.member_id = c.leader_id
             JOIN public.members l ON l.id = c.leader_id
            WHERE c.is_active AND c.deleted_at IS NULL AND l.deleted_at IS NULL AND h.g12_level >= 1) AS cells_under,
          (SELECT count(*) FROM lcell c WHERE c.resolved AND cardinality(c.anc) >= 1) AS legacy_under,
          (SELECT count(*) FROM public.cells c JOIN private.member_hierarchy h ON h.member_id = c.leader_id
             JOIN public.members l ON l.id = c.leader_id
            WHERE c.legacy_id IS NULL AND c.is_active AND c.deleted_at IS NULL AND l.deleted_at IS NULL
              AND h.g12_level >= 1) AS new_only_under) x
UNION ALL
-- Uma carga sem o recálculo deixa masculinas e femininas zeradas (RN-13 do E2.06).
SELECT 'metric', 'cells_by_gender', NULL, NULL, NULL, NULL,
       jsonb_build_object('active_cells', x.active_cells, 'male', x.male, 'female', x.female,
                          'ok', x.active_cells = 0 OR x.male + x.female > 0)
  FROM (SELECT
          (SELECT count(*) FROM public.cells c WHERE c.is_active AND c.deleted_at IS NULL) AS active_cells,
          (SELECT coalesce(max(h.male_cells), 0) FROM private.member_hierarchy h) AS male,
          (SELECT coalesce(max(h.female_cells), 0) FROM private.member_hierarchy h) AS female) x
ORDER BY 1, 2, 3, 4, 5;
