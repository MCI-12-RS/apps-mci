-- =============================================================================
-- E4.06/E4.07, passo 10 (DT-10): validação antes do commit. Um comando só; cada
-- linha é um problema (item, detail, legacy_id). Qualquer linha desfaz a carga.
-- As FKs das quatro tabelas (o replica não confere) são conferidas pelo script,
-- a partir do catálogo (src/load.mjs, fkCheckSql).
-- legacy_id nulo = cadastro do novo (fora da carga) ou item sem Id (contagens).
-- Usa as tabelas temporárias da transformação (member_map, cell_map, report_map, lp,
-- admin_check), da mesma transação.
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
UNION ALL
-- Os Administradores válidos da lista (não adotados, não excluídos, com identificador)
-- ficaram com a função de sistema (DT-11).
SELECT 'roles', 'admin_without_system_role', a.lid
  FROM admin_check a
  JOIN member_map mm ON mm.lid = a.lid
  JOIN public.members m ON m.id = mm.id
 WHERE a.included AND NOT a.del AND a.has_identifier AND NOT a.adopted
   AND m.role_id IS DISTINCT FROM (SELECT r.id FROM public.roles r WHERE r.is_system)
UNION ALL
-- O que foi gravado com legacy_id é exatamente o planejado na transformação (cada Id do
-- mapa no cadastro do mapa); os carregados antes e ausentes agora ficam de fora da conta.
SELECT 'planned_count', x.entity || ': planejado ' || x.planned || ', gravado ' || x.written, NULL
  FROM (
    SELECT 'members' AS entity, (SELECT count(*) FROM member_map) AS planned,
           (SELECT count(*) FROM member_map mm JOIN public.members m ON m.id = mm.id AND m.legacy_id = mm.lid) AS written
    UNION ALL
    SELECT 'cells', (SELECT count(*) FROM cell_map),
           (SELECT count(*) FROM cell_map cm JOIN public.cells c ON c.id = cm.id AND c.legacy_id = cm.lid)
    UNION ALL
    SELECT 'cell_reports', (SELECT count(*) FROM report_map),
           (SELECT count(*) FROM report_map rm JOIN public.cell_reports r ON r.id = rm.id AND r.legacy_id = rm.lid)
    UNION ALL
    SELECT 'cell_report_participants',
           (SELECT count(*) FROM (SELECT DISTINCT report_id, member_id FROM lp
                                   WHERE report_id IS NOT NULL AND member_id IS NOT NULL) d),
           (SELECT count(*) FROM public.cell_report_participants p
             WHERE p.report_id IN (SELECT id FROM report_map)
               AND EXISTS (SELECT 1 FROM lp WHERE lp.report_id = p.report_id AND lp.member_id = p.member_id))
           - (SELECT count(*) FROM public.cell_report_participants p
               WHERE p.report_id IN (SELECT id FROM report_map)
                 AND NOT EXISTS (SELECT 1 FROM lp WHERE lp.report_id = p.report_id AND lp.member_id = p.member_id))
  ) x
 WHERE x.planned <> x.written
ORDER BY 1, 2, 3;
