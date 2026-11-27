-- E4.08 (DT-14; 6.3; RN-01, RN-03 e RN-16 do E3): credenciais legadas de um lote de
-- membros ($1, até 100 ids), como postgres, um comando por lote.
--
-- O MD5 sai direto de legacy."Members" e só entra na private.add_legacy_credential:
-- nunca é parâmetro do comando (auto_explain, DT-19 do E1.04), nem sai no resultado.
-- Minúsculas e sem os espaços das pontas antes (sugestão do code-reviewer no
-- mci-connect#60): o legado gravava o MD5 hexadecimal minúsculo do pacote md5; maiúsculas
-- ou espaços nas pontas são do banco, não da senha. Espaço é o mesmo da carga
-- (pg_temp.trim_space: [[:space:]] e o NBSP; o btrim só tira o espaço comum) e o mesmo de
-- 10_plan.sql. "normalized" diz quem só passou por causa disso.
--
-- Atalho "unchanged": credencial pendente cujo hash já confere com o MD5 do legado não
-- é regravada (refazer não muda nada). O custo é o mesmo bcrypt da regravação.
SELECT m.legacy_id,
       CASE
         WHEN c.legacy_hash IS NOT NULL AND c.used_at IS NULL AND v.password_hash IS NULL
              AND n.md5 ~ '^[0-9a-f]{32}$' AND n.md5 <> 'd41d8cd98f00b204e9800998ecf8427e'
              AND extensions.crypt(n.md5, c.legacy_hash) = c.legacy_hash
           THEN 'unchanged'
         ELSE private.add_legacy_credential(m.id, n.md5)
       END AS result,
       l."Password" IS DISTINCT FROM n.md5 AS normalized
  FROM public.members m
  LEFT JOIN legacy."Members" l ON l."Id" = m.legacy_id
 CROSS JOIN LATERAL (SELECT lower(regexp_replace(l."Password", '^[[:space:]\u00a0]+|[[:space:]\u00a0]+$', '', 'g')) AS md5) n
  LEFT JOIN private.legacy_credentials c ON c.member_id = m.id
  LEFT JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
 WHERE m.id = ANY ($1::uuid[]);
