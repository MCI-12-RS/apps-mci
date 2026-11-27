-- E4.08 (DT-14): validação no fim. Precisa voltar vazia.
--   validate_legacy_credential_problem  private.legacy_credential_problems() (de toda a base)
--   validate_account_missing            elegível do plano sem a conta dele ligada
SELECT 'validate_legacy_credential_problem' AS code, m.legacy_id, p.problem AS info
  FROM private.legacy_credential_problems() p
  LEFT JOIN public.members m ON m.id = p.member_id
UNION ALL
SELECT 'validate_account_missing', p.legacy_id, NULL
  FROM acc_plan p
  JOIN public.members m ON m.id = p.id
 WHERE p.action IN ('create', 'relink', 'linked')
   AND m.deleted_at IS NULL
   AND NOT (m.auth_user_id IS NOT DISTINCT FROM m.id
            AND EXISTS (SELECT 1 FROM auth.users u
                         WHERE u.id = m.id AND lower(u.email) = p.tech_email
                           AND u.raw_app_meta_data->>'legacy_member_id' = m.legacy_id::text))
ORDER BY 1, 2, 3;
