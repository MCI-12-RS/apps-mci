-- E4.08 (DT-14): liga o cadastro à conta criada (auth_user_id = id), em replica (sem
-- Auditoria nem carimbo, RN-10 e do E2.05), num lote de ids ($1). Só liga quem continua
-- elegível e cuja conta é a do membro (id, e-mail técnico e Id do legado).
UPDATE public.members m
   SET auth_user_id = m.id
 WHERE m.id = ANY ($1::uuid[])
   AND m.auth_user_id IS NULL
   AND m.legacy_id IS NOT NULL
   AND m.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM auth.users u
                WHERE u.id = m.id
                  AND lower(u.email) = lower(public.member_account_email(m.id))
                  AND u.raw_app_meta_data->>'legacy_member_id' = m.legacy_id::text)
RETURNING m.legacy_id;
