-- E4.08 (DT-14 do spec e4-carga): plano das contas, sem gravar nada fora de pg_temp.
--
-- Uma linha por membro carregado (legacy_id preenchido) em acc_plan, com a ação:
--   create        elegível sem conta: criar pela Admin API (id = id do membro, e-mail técnico)
--   relink        elegível sem auth_user_id, cuja conta (do mesmo membro) já existe: só religar
--   linked        já ligado à conta criada pela carga: só a credencial
--   adopted       adotado que já tinha conta no novo (RN-16 a do E3): nada
--   deleted       excluído: sem conta (6.2, RN-09 do E3)
--   no_identifier sem e-mail, celular ou CPF válido: sem conta
--   blocked       conta de outro dono, Id do legado em outra conta ou ligação inesperada
-- Elegível (DT-14): não excluído, member_has_login_identifier e não adotado com conta.
-- "Conta do membro" = auth.users com id = id do membro, o e-mail técnico
-- member_account_email(id) e app_metadata.legacy_member_id = o Id do legado.
-- Ocorrências em acc_issues (código, Id do legado, observação sem dado pessoal).
-- A senha do legado é lida só para a previsão (formato), nunca sai daqui.

DROP TABLE IF EXISTS pg_temp.acc_plan, pg_temp.acc_issues, pg_temp.acc_auth;
CREATE TEMP TABLE acc_issues (code text NOT NULL, legacy_id integer, info text);

-- As contas do Auth, uma vez, com índices (o plano consulta por e-mail e pelo Id do legado).
CREATE TEMP TABLE acc_auth AS
SELECT u.id, lower(u.email) AS email, u.raw_app_meta_data->>'legacy_member_id' AS marker,
       coalesce(u.raw_app_meta_data ? 'legacy_member_id', false) AS has_marker
  FROM auth.users u;
CREATE INDEX ON acc_auth (email);
CREATE INDEX ON acc_auth (marker);
ANALYZE acc_auth;

CREATE TEMP TABLE acc_plan AS
WITH m AS (
  SELECT m.id, m.legacy_id, m.auth_user_id, m.deleted_at IS NOT NULL AS del,
         coalesce(public.member_has_login_identifier(m.email, m.mobile_whatsapp, m.cpf), false) AS has_identifier,
         a.member_id IS NOT NULL AS adopted,
         a.member_id IS NOT NULL AND m.auth_user_id IS NOT NULL
           AND m.auth_user_id::text = a.before->>'auth_user_id' AS adopted_account,
         lower(public.member_account_email(m.id)) AS tech_email
    FROM public.members m
    LEFT JOIN legacy._load_adopted a ON a.member_id = m.id
   WHERE m.legacy_id IS NOT NULL
)
SELECT m.*,
       u.id AS u_id,
       coalesce(u.email = m.tech_email AND u.marker = m.legacy_id::text, false) AS u_mine,
       EXISTS (SELECT 1 FROM acc_auth e WHERE e.email = m.tech_email AND e.id <> m.id) AS email_taken,
       EXISTS (SELECT 1 FROM acc_auth o WHERE o.marker = m.legacy_id::text AND o.id <> m.id) AS legacy_id_taken,
       l."Id" IS NOT NULL AS legacy_row,
       lower(btrim(l."Password")) AS pw,
       l."Password" IS DISTINCT FROM lower(btrim(l."Password")) AS pw_normalized,
       v.password_hash IS NOT NULL AS has_password,
       c.member_id IS NOT NULL AS has_credential,
       c.legacy_hash IS NOT NULL AND c.used_at IS NULL AS credential_pending,
       NULL::text AS action
  FROM m
  LEFT JOIN acc_auth u ON u.id = m.id
  LEFT JOIN legacy."Members" l ON l."Id" = m.legacy_id
  LEFT JOIN private.account_passwords v ON v.auth_user_id = m.auth_user_id
  LEFT JOIN private.legacy_credentials c ON c.member_id = m.id;

ALTER TABLE acc_plan ADD COLUMN pw_usable boolean;
UPDATE acc_plan SET pw_usable = coalesce(pw ~ '^[0-9a-f]{32}$' AND pw <> 'd41d8cd98f00b204e9800998ecf8427e', false);

UPDATE acc_plan SET action = CASE
    WHEN del THEN 'deleted'
    WHEN adopted_account THEN 'adopted'
    WHEN NOT has_identifier THEN 'no_identifier'
    WHEN legacy_id_taken OR email_taken THEN 'blocked'
    WHEN auth_user_id IS NOT NULL THEN
      CASE WHEN auth_user_id = id AND u_mine THEN 'linked' ELSE 'blocked' END
    WHEN u_id IS NOT NULL THEN CASE WHEN u_mine THEN 'relink' ELSE 'blocked' END
    ELSE 'create'
  END;

CREATE UNIQUE INDEX ON acc_plan (id);

-- Bloqueios (antes de criar qualquer conta).
INSERT INTO acc_issues (code, legacy_id, info)
SELECT CASE
         WHEN legacy_id_taken THEN 'account_legacy_id_taken'
         WHEN auth_user_id IS NOT NULL THEN 'account_link_unexpected'
         ELSE 'account_other_owner'
       END,
       legacy_id,
       CASE
         WHEN legacy_id_taken THEN 'outra conta com este Id do legado'
         WHEN auth_user_id IS NOT NULL AND auth_user_id <> id THEN 'ligado a uma conta de outro id'
         WHEN auth_user_id IS NOT NULL AND u_id IS NULL THEN 'a conta ligada não existe no Auth'
         WHEN auth_user_id IS NOT NULL THEN 'a conta ligada não tem o e-mail técnico ou o Id do legado'
         WHEN email_taken THEN 'o e-mail técnico está em outra conta'
         ELSE 'a conta com este id não tem o e-mail técnico ou o Id do legado'
       END
  FROM acc_plan WHERE action = 'blocked';

-- Informativos.
INSERT INTO acc_issues (code, legacy_id, info)
SELECT 'member_without_identifier', legacy_id, NULL FROM acc_plan WHERE action = 'no_identifier' AND auth_user_id IS NULL
UNION ALL
SELECT 'member_without_identifier_with_account', legacy_id, NULL FROM acc_plan WHERE action = 'no_identifier' AND auth_user_id IS NOT NULL
UNION ALL
SELECT 'member_deleted_with_account', legacy_id, NULL FROM acc_plan WHERE action = 'deleted' AND auth_user_id IS NOT NULL
UNION ALL
SELECT 'account_adopted_kept', legacy_id, NULL FROM acc_plan WHERE action = 'adopted'
UNION ALL
SELECT 'account_adopted_without_password', legacy_id, NULL FROM acc_plan WHERE action = 'adopted' AND NOT has_password
UNION ALL
SELECT 'legacy_row_missing', legacy_id, NULL FROM acc_plan WHERE action IN ('create', 'relink', 'linked') AND NOT legacy_row
UNION ALL
-- Contas com Id do legado no app_metadata que não são de nenhum membro carregado com esse Id.
SELECT 'account_orphan',
       CASE WHEN u.marker ~ '^[0-9]{1,9}$' THEN u.marker::integer END,
       CASE WHEN u.marker ~ '^[0-9]{1,9}$' THEN NULL ELSE 'Id do legado ilegível' END
  FROM acc_auth u
 WHERE u.has_marker
   AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = u.id AND m.legacy_id::text = u.marker);
