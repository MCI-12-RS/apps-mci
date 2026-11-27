-- =============================================================================
-- Limpeza do ensaio (DT-13), passo 3: recálculos do zero. Os dois apagam antes as
-- linhas órfãs (DT-03: a exclusão em replica não cascateia) e devolvem quantas
-- linhas mudaram: cadeia, nível e totais (E2.06) e períodos ativos das células (E2.09).
-- =============================================================================
INSERT INTO ul_counts SELECT 'hierarchy_rebuilt', private.rebuild_member_hierarchy();
INSERT INTO ul_counts SELECT 'cell_periods_backfilled', private.backfill_cell_active_periods();
