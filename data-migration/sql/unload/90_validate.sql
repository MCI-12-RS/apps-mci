-- =============================================================================
-- Limpeza do ensaio (DT-13), passo 4: validação antes do commit. Precisa voltar vazia
-- (o runner junta a conferência de FKs, montada do catálogo). Uma linha por problema:
-- item, detalhe, quantidade.
-- =============================================================================
SELECT 'legacy_id_remaining' AS item, t AS detail, n
  FROM (SELECT 'members' AS t, count(*) AS n FROM public.members WHERE legacy_id IS NOT NULL
        UNION ALL SELECT 'cells', count(*) FROM public.cells WHERE legacy_id IS NOT NULL
        UNION ALL SELECT 'cell_reports', count(*) FROM public.cell_reports WHERE legacy_id IS NOT NULL) x
 WHERE n > 0
UNION ALL
SELECT 'adopted_remaining', 'legacy._load_adopted', count(*) FROM legacy._load_adopted HAVING count(*) > 0
UNION ALL
SELECT 'member_hierarchy_drift', problem::text, count(*) FROM private.member_hierarchy_drift() GROUP BY 2
UNION ALL
SELECT 'cell_active_period_problems', problem::text, count(*) FROM private.cell_active_period_problems() GROUP BY 2
UNION ALL
SELECT 'member_rule_violations', rule::text, count(*) FROM private.member_rule_violations() GROUP BY 2
UNION ALL
SELECT 'cell_rule_violations', rule::text, count(*) FROM private.cell_rule_violations() GROUP BY 2
UNION ALL
SELECT 'legacy_credential_problems', problem::text, count(*) FROM private.legacy_credential_problems() GROUP BY 2
UNION ALL
-- Cônjuge que não fecha nos dois lados, entre os cadastros que a limpeza mexeu (adotados e
-- os do plano do cônjuge).
SELECT 'spouse_not_reciprocal', 'members', count(*)
  FROM public.members x JOIN public.members y ON y.id = x.spouse_id
 WHERE (x.id IN (SELECT id FROM ul_adopted) OR y.id IN (SELECT id FROM ul_adopted)
        OR x.id IN (SELECT id FROM ul_spouse_touched) OR y.id IN (SELECT id FROM ul_spouse_touched))
   AND y.spouse_id IS DISTINCT FROM x.id
HAVING count(*) > 0
UNION ALL
-- Conta que vai sair e ainda é de um cadastro que fica.
SELECT 'account_still_linked', 'members', count(*)
  FROM public.members m JOIN ul_accounts a ON a.id = m.auth_user_id
HAVING count(*) > 0
ORDER BY 1, 2;
