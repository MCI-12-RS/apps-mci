-- =============================================================================
-- E4.09: contas, credenciais legadas e funções (6.2, 6.3, 6.5; RN-01, RN-16, RN-18 do E3; DT-11,
-- DT-14 do E4).
--   account_missing       carregado elegível (não excluído, com e-mail, celular ou CPF) sem a conta
--                         dele (id = id do membro, e-mail técnico, Id do legado), ou adotado sem a conta
--                         que já tinha
--   account_unexpected    carregado não elegível com conta (esperada, só listada: PR4-8)
--   account_orphan        conta com Id do legado sem o cadastro desse Id
--   credential_missing    elegível com conta, sem credencial legada (esperada: senha do legado não
--                         utilizável, a lista "sem senha" da 5.4; ou já tem senha no novo)
--   credential_unexpected credencial ativa de quem não é elegível, de adotado com conta (RN-16 a) ou
--                         de cadastro sem Id do legado
--   credential_hash_mismatch  amostra (mci.rc_cred_sample): o bcrypt guardado confere com o MD5 do legado
--   role_mismatch         função da RN-18 do E3 (Administrador pela lista, Líder para o G12, a padrão
--                         para os demais); o adotado fica com a dele
--   admins (metric)       pelo menos 2 Administradores não excluídos, com conta e identificador
--   credentials (metric)  "created" = membros com senha utilizável e conta
-- O MD5 é lido do legado só dentro do banco (nunca é parâmetro nem sai daqui).
-- =============================================================================
WITH /*BASE*/,
m AS (
  SELECT m.id, m.legacy_id AS lid, m.auth_user_id, m.deleted_at IS NOT NULL AS del, m.role_id,
         coalesce(public.member_has_login_identifier(m.email, m.mobile_whatsapp, m.cpf), false) AS has_identifier,
         a.member_id IS NOT NULL AS adopted,
         a.member_id IS NOT NULL AND (a.before->>'auth_user_id') IS NOT NULL
           AND m.auth_user_id::text = a.before->>'auth_user_id' AS adopted_account,
         u.id IS NOT NULL AS account_exists,
         u.id = m.id AND u.raw_app_meta_data->>'legacy_member_id' = m.legacy_id::text
           AND lower(u.email) = lower(public.member_account_email(m.id)) AS account_mine,
         v.password_hash IS NOT NULL AS has_password,
         c.member_id IS NOT NULL AS has_cred, c.legacy_hash IS NOT NULL AS cred_active,
         coalesce(pw.md5 ~ '^[0-9a-f]{32}$' AND pw.md5 <> 'd41d8cd98f00b204e9800998ecf8427e', false) AS pw_usable,
         h.g12_level
    FROM public.members m
    LEFT JOIN legacy._load_adopted a ON a.member_id = m.id
    LEFT JOIN auth.users u ON u.id = m.auth_user_id
    LEFT JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
    LEFT JOIN private.legacy_credentials c ON c.member_id = m.id
    LEFT JOIN legacy."Members" l ON l."Id" = m.legacy_id
   CROSS JOIN LATERAL (SELECT lower(regexp_replace(l."Password", '^[[:space:] ]+|[[:space:] ]+$', '', 'g')) AS md5) pw
    LEFT JOIN private.member_hierarchy h ON h.member_id = m.id
   WHERE m.legacy_id IS NOT NULL
),
e AS (
  SELECT m.*, NOT m.del AND m.has_identifier AS eligible,
         CASE WHEN m.adopted_account THEN m.account_exists
              ELSE coalesce(m.auth_user_id = m.id AND m.account_mine, false) END AS account_ok
    FROM m
),
roles AS (
  SELECT (SELECT id FROM public.roles WHERE is_system) AS sys,
         (SELECT id FROM public.roles WHERE name = 'Líder' AND NOT is_system ORDER BY id LIMIT 1) AS lider,
         (SELECT id FROM public.roles WHERE is_default) AS dflt
),
rexp AS (
  SELECT e.lid, e.role_id,
         CASE WHEN e.lid = ANY (cfg.admin_ids) AND NOT e.del AND e.has_identifier THEN roles.sys
              WHEN NOT e.del AND e.g12_level = 1 THEN roles.lider
              ELSE roles.dflt END AS exp_role,
         roles.sys, roles.lider, roles.dflt
    FROM e CROSS JOIN cfg CROSS JOIN roles
   WHERE NOT e.adopted
),
-- Primeiro o sorteio (LIMIT), depois o bcrypt (~60 ms cada): só nos sorteados.
sample_ids AS (
  SELECT m.legacy_id AS lid, c.legacy_hash, l."Password" AS pw
    FROM private.legacy_credentials c
    JOIN public.members m ON m.id = c.member_id AND m.legacy_id IS NOT NULL
    JOIN legacy."Members" l ON l."Id" = m.legacy_id
   CROSS JOIN cfg
   WHERE c.legacy_hash IS NOT NULL
   ORDER BY md5(cfg.seed || ':' || m.legacy_id)
   LIMIT (SELECT cred_sample FROM cfg)
),
sample AS (
  SELECT s.lid,
         extensions.crypt(lower(regexp_replace(s.pw, '^[[:space:]\u00a0]+|[[:space:]\u00a0]+$', '', 'g')), s.legacy_hash)
           = s.legacy_hash AS ok
    FROM sample_ids s
)
SELECT 'diff'::text AS kind, 'account_missing'::text AS code, e.lid::bigint AS lid, NULL::text AS ref,
       CASE WHEN e.auth_user_id IS NULL THEN 'sem conta ligada'
            WHEN NOT e.account_exists THEN 'a conta ligada não existe no Auth'
            WHEN e.adopted_account THEN 'adotado sem a conta que tinha'
            WHEN e.auth_user_id <> e.id THEN 'ligado a uma conta de outro id'
            ELSE 'a conta não tem o e-mail técnico ou o Id do legado' END AS detail,
       NULL::text AS expected, NULL::jsonb AS data
  FROM e
 WHERE e.eligible AND NOT e.account_ok
UNION ALL
SELECT 'diff', 'account_unexpected', e.lid, NULL,
       CASE WHEN e.del THEN 'excluído com conta' ELSE 'sem identificador, com conta' END,
       CASE WHEN e.del THEN 'account_on_deleted_member' ELSE 'account_without_identifier' END, NULL
  FROM e
 WHERE NOT e.eligible AND e.auth_user_id IS NOT NULL
UNION ALL
SELECT 'diff', 'account_orphan',
       CASE WHEN u.raw_app_meta_data->>'legacy_member_id' ~ '^[0-9]{1,9}$' THEN (u.raw_app_meta_data->>'legacy_member_id')::bigint END,
       'conta ' || u.id, NULL, NULL, NULL
  FROM auth.users u
 WHERE u.raw_app_meta_data ? 'legacy_member_id'
   AND NOT EXISTS (SELECT 1 FROM public.members x
                    WHERE x.id = u.id AND x.legacy_id::text = u.raw_app_meta_data->>'legacy_member_id')
UNION ALL
SELECT 'diff', 'credential_missing', e.lid, NULL,
       concat_ws('; ', CASE WHEN NOT e.pw_usable THEN 'senha do legado não utilizável' END,
                       CASE WHEN e.has_password THEN 'já tem senha no novo' END),
       nullif(concat_ws(',', CASE WHEN NOT e.pw_usable THEN 'credential_unusable_md5' END,
                             CASE WHEN e.has_password THEN 'credential_has_password' END), ''),
       NULL
  FROM e
 WHERE e.eligible AND e.account_ok AND NOT e.adopted_account AND NOT e.has_cred
UNION ALL
SELECT 'diff', 'credential_unexpected', e.lid, NULL,
       CASE WHEN e.del THEN 'excluído' WHEN e.adopted_account THEN 'adotado com conta' ELSE 'sem identificador' END,
       NULL, NULL
  FROM e
 WHERE e.cred_active AND (NOT e.eligible OR e.adopted_account)
UNION ALL
SELECT 'diff', 'credential_unexpected', NULL, 'cadastro só do novo ' || c.member_id, NULL, NULL, NULL
  FROM private.legacy_credentials c JOIN public.members x ON x.id = c.member_id
 WHERE c.legacy_hash IS NOT NULL AND x.legacy_id IS NULL
UNION ALL
SELECT 'diff', 'credential_hash_mismatch', s.lid, NULL, 'o bcrypt não confere com o MD5 do legado', NULL, NULL
  FROM sample s WHERE NOT s.ok
UNION ALL
SELECT 'diff', 'role_mismatch', r.lid, NULL,
       format('função: esperada %s, no novo %s',
              CASE r.exp_role WHEN r.sys THEN 'Administrador' WHEN r.lider THEN 'Líder' ELSE 'a padrão' END,
              CASE WHEN r.role_id IS NULL THEN 'nenhuma' WHEN r.role_id = r.sys THEN 'Administrador'
                   WHEN r.role_id = r.lider THEN 'Líder' WHEN r.role_id = r.dflt THEN 'a padrão' ELSE 'outra' END),
       NULL, NULL
  FROM rexp r
 WHERE r.role_id IS DISTINCT FROM r.exp_role
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', c.n)
  FROM (VALUES ('account_missing', (SELECT count(*) FROM e WHERE e.eligible)),
               ('account_unexpected', (SELECT count(*) FROM e WHERE NOT e.eligible)),
               ('account_orphan', (SELECT count(*) FROM auth.users u WHERE u.raw_app_meta_data ? 'legacy_member_id')),
               ('credential_missing', (SELECT count(*) FROM e WHERE e.eligible AND e.account_ok AND NOT e.adopted_account)),
               ('credential_unexpected', (SELECT count(*) FROM private.legacy_credentials WHERE legacy_hash IS NOT NULL)),
               ('credential_hash_mismatch', (SELECT count(*) FROM sample)),
               ('role_mismatch', (SELECT count(*) FROM rexp))) c(code, n)
UNION ALL
SELECT 'metric', 'admins', NULL, NULL, NULL, NULL,
       jsonb_build_object('n', x.n, 'loaded', x.loaded, 'ok', x.n >= 2)
  FROM (SELECT count(*) AS n, count(*) FILTER (WHERE mm.legacy_id IS NOT NULL) AS loaded
          FROM public.members mm
          JOIN public.roles r ON r.id = mm.role_id AND r.is_system
          JOIN auth.users u ON u.id = mm.auth_user_id
         WHERE mm.deleted_at IS NULL
           AND coalesce(public.member_has_login_identifier(mm.email, mm.mobile_whatsapp, mm.cpf), false)) x
UNION ALL
SELECT 'metric', 'credentials', NULL, NULL, NULL, NULL,
       jsonb_build_object(
         'with_account', (SELECT count(*) FROM e WHERE e.eligible AND e.account_ok AND NOT e.adopted_account),
         'usable', (SELECT count(*) FROM e WHERE e.eligible AND e.account_ok AND NOT e.adopted_account AND e.pw_usable),
         'credentials', (SELECT count(*) FROM e WHERE e.has_cred),
         'active', (SELECT count(*) FROM e WHERE e.cred_active),
         'used_or_discarded', (SELECT count(*) FROM e WHERE e.has_cred AND NOT e.cred_active),
         'with_password_in_new', (SELECT count(*) FROM e WHERE e.eligible AND e.has_password),
         'ok', NULL)
ORDER BY 1, 2, 3, 4, 5;
