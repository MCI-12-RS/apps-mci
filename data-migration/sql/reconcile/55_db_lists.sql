-- =============================================================================
-- E4.09: as listas de problemas do próprio banco (5.6), como postgres. Precisam voltar vazias,
-- menos private.member_hierarchy_problems(), que é a lista para a liderança (atenção).
--   db_hierarchy_drift     private.member_hierarchy_drift() (E2.06, DT-03 do E4)
--   db_member_rules        private.member_rule_violations() (E2.04, RN-18)
--   db_cell_rules          private.cell_rule_violations() (E2.08, RN-13)
--   db_active_periods      private.cell_active_period_problems() (E2.09)
--   db_credential_problems private.legacy_credential_problems() (E3)
--   hierarchy_problems     private.member_hierarchy_problems(): no_top, cell_leader_deleted,
--                          no_leadership_with_disciples (atenção, não falha)
-- O id do novo só aparece para quem não tem Id do legado.
-- =============================================================================
WITH /*BASE*/
SELECT 'item'::text AS kind, 'db_hierarchy_drift'::text AS code, m.legacy_id::bigint AS lid,
       CASE WHEN m.legacy_id IS NULL THEN coalesce(d.member_id::text, '—') END AS ref, d.problem AS detail,
       NULL::text AS expected, NULL::jsonb AS data
  FROM private.member_hierarchy_drift() d LEFT JOIN public.members m ON m.id = d.member_id
UNION ALL
SELECT 'item', 'db_member_rules', m.legacy_id, CASE WHEN m.legacy_id IS NULL THEN v.member_id::text END, v.rule, NULL, NULL
  FROM private.member_rule_violations() v LEFT JOIN public.members m ON m.id = v.member_id
UNION ALL
SELECT 'item', 'db_cell_rules', c.legacy_id, CASE WHEN c.legacy_id IS NULL THEN v.cell_id::text END, v.rule, NULL, NULL
  FROM private.cell_rule_violations() v LEFT JOIN public.cells c ON c.id = v.cell_id
UNION ALL
SELECT 'item', 'db_active_periods', c.legacy_id, CASE WHEN c.legacy_id IS NULL THEN v.cell_id::text END, v.problem, NULL, NULL
  FROM private.cell_active_period_problems() v LEFT JOIN public.cells c ON c.id = v.cell_id
UNION ALL
SELECT 'item', 'db_credential_problems', m.legacy_id, CASE WHEN m.legacy_id IS NULL THEN v.member_id::text END, v.problem, NULL, NULL
  FROM private.legacy_credential_problems() v LEFT JOIN public.members m ON m.id = v.member_id
UNION ALL
SELECT 'item', 'hierarchy_problems', m.legacy_id, CASE WHEN m.legacy_id IS NULL THEN v.member_id::text END, v.problem, NULL, NULL
  FROM private.member_hierarchy_problems() v LEFT JOIN public.members m ON m.id = v.member_id
ORDER BY 1, 2, 3, 4, 5;
