-- =============================================================================
-- E4.06/E4.07, passo 10 (DT-10): validação antes do commit. Um comando só; cada
-- linha é um problema (item, detail, legacy_id). Qualquer linha desfaz a carga.
-- As FKs das quatro tabelas (o replica não confere) são conferidas pelo script,
-- a partir do catálogo (src/load.mjs, fkCheckSql).
-- legacy_id nulo = cadastro do novo (fora da carga).
-- =============================================================================
SELECT 'member_hierarchy_drift' AS item, d.problem AS detail, m.legacy_id
  FROM private.member_hierarchy_drift() d LEFT JOIN public.members m ON m.id = d.member_id
UNION ALL
SELECT 'cell_active_period_problems', p.problem, c.legacy_id
  FROM private.cell_active_period_problems() p LEFT JOIN public.cells c ON c.id = p.cell_id
UNION ALL
SELECT 'member_rule_violations', v.rule, m.legacy_id
  FROM private.member_rule_violations() v LEFT JOIN public.members m ON m.id = v.member_id
UNION ALL
SELECT 'cell_rule_violations', v.rule, c.legacy_id
  FROM private.cell_rule_violations() v LEFT JOIN public.cells c ON c.id = v.cell_id
UNION ALL
-- Exatamente uma função padrão e uma de sistema (o constraint trigger confere no commit;
-- aqui a mensagem sai antes).
SELECT 'roles', 'default_count', NULL FROM public.roles HAVING count(*) FILTER (WHERE is_default) <> 1
UNION ALL
-- Todo carregado não adotado tem função.
SELECT 'roles', 'missing_role', m.legacy_id
  FROM public.members m
 WHERE m.legacy_id IS NOT NULL AND m.role_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM legacy._load_adopted a WHERE a.member_id = m.id)
ORDER BY 1, 2, 3;
