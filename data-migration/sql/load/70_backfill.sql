-- =============================================================================
-- E4.06/E4.07, passos 7 a 9 (DT-06): recálculo da hierarquia (E2.06), funções
-- (DT-11, RN-18 do E3) e períodos ativos das células (E2.09).
-- =============================================================================

-- (7) Cadeia, nível, G12 e totais, do zero, com as regras das gravações.
CREATE TEMP TABLE load_backfill (step text PRIMARY KEY, n integer) ON COMMIT DROP;
INSERT INTO load_backfill SELECT 'hierarchy_rebuilt', private.rebuild_member_hierarchy();

-- (8) Funções, só para quem não foi adotado (o adotado fica com a do novo, Q-E4-1):
-- Administrador para LEGACY_ADMIN_IDS (não excluídos), Líder para o G12
-- (g12_level = 1, inclusive abaixo de um topo sem liderança e inativo), a padrão
-- para os demais, inclusive excluídos. Refazer só regrava quem mudou.
WITH roles AS (
  SELECT (SELECT id FROM public.roles WHERE is_system) AS sys,
         (SELECT id FROM public.roles WHERE is_default) AS def,
         (SELECT id FROM public.roles WHERE name = 'Líder' AND NOT is_system) AS lider
),
target AS (
  SELECT m.id,
         CASE WHEN m.legacy_id = ANY (cfg.admin_ids) AND m.deleted_at IS NULL THEN r.sys
              WHEN h.g12_level = 1 THEN r.lider
              ELSE r.def END AS role_id
    FROM member_map mm
    JOIN public.members m ON m.id = mm.id
    LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
   CROSS JOIN roles r
   CROSS JOIN load_cfg cfg
   WHERE NOT EXISTS (SELECT 1 FROM member_adopted a WHERE a.id = mm.id)
),
up AS (
  UPDATE public.members m SET role_id = t.role_id
    FROM target t
   WHERE m.id = t.id AND m.role_id IS DISTINCT FROM t.role_id
  RETURNING m.id
)
INSERT INTO load_backfill SELECT 'roles_assigned', count(*) FROM up;

-- (9) Períodos ativos: a célula carregada que mudou nesta carga é recalculada a
-- partir do created_at do legado (nulo = desde sempre, RN-10 do E2.09).
WITH d AS (
  DELETE FROM private.cell_active_periods p
   USING load_written w
   WHERE w.entity = 'cells' AND p.cell_id = w.id
  RETURNING 1
)
INSERT INTO load_backfill SELECT 'cell_periods_reset', count(*) FROM d;
INSERT INTO load_backfill SELECT 'cell_periods_backfilled', private.backfill_cell_active_periods();
