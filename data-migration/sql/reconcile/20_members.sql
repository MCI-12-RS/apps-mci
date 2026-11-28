-- =============================================================================
-- E4.09: membros, um a um, pelo legacy_id (5.6: contagens, líder, cônjuge).
--   member_missing  no legado e não no novo (esperada: nome ou sexo inválido, PR2-1 e Q-E4-6)
--   member_extra    no novo com um Id que o legado não tem
--   member_status   excluído ou ativo diferente
--   member_field    campo diferente (nome, sexo, identificadores, nascimento, batismo, pastor,
--                   observações, endereço); o detalhe cita só o campo
--   member_leader   líder (pelo Id do legado) diferente; esperada só quando o novo ficou sem
--                   líder pelas regras da carga (DT-07, DT-12)
--   member_spouse   cônjuge diferente; esperada só quando o vínculo foi desfeito (DEL-05)
-- As regras de leitura (e-mail, celular, CPF, nome) são as funções do próprio banco, as mesmas
-- da carga; o valor nunca sai daqui.
-- =============================================================================
WITH /*BASE*/,
n AS (SELECT m.* FROM public.members m WHERE m.legacy_id IS NOT NULL),
lx AS (
  SELECT b.*,
         public.normalize_person_name(x."Name") AS name,
         public.normalize_email(x."Email") AS email,
         coalesce(public.normalize_mobile(x."MobileNumber"), public.normalize_digits(x."MobileNumber")) AS mobile,
         public.normalize_digits(x."CPF") AS cpf,
         public.normalize_digits(x."PhoneNumber") AS phone,
         x."BirthDate"::date AS birth_date,
         coalesce(x."Baptized", false) AS is_baptized,
         x."BaptismDate"::date AS baptism_date,
         CASE WHEN x."Notes" ~ '^[[:space:]]*$' THEN NULL ELSE x."Notes" END AS notes,
         ROW(CASE WHEN a."Street" ~ '^[[:space:]]*$' THEN NULL ELSE a."Street" END,
             CASE WHEN a."Number" ~ '^[[:space:]]*$' THEN NULL ELSE a."Number" END,
             CASE WHEN a."Notes" ~ '^[[:space:]]*$' THEN NULL ELSE a."Notes" END,
             CASE WHEN a."Neighborhood" ~ '^[[:space:]]*$' THEN NULL ELSE a."Neighborhood" END,
             CASE WHEN a."City" ~ '^[[:space:]]*$' THEN NULL ELSE a."City" END,
             upper(CASE WHEN btrim(a."State") ~ '^[[:space:]]*$' THEN NULL ELSE btrim(a."State") END),
             public.normalize_digits(a."PostalCode"))::text AS address,
         (b.lid = ANY (cfg.pastor_ids) AND NOT b.del AND NOT b.no_leadership AND b.leader_raw IS NULL) AS exp_pastor
    FROM legacy."Members" x
    JOIN lmb b ON b.lid = x."Id"
   CROSS JOIN cfg
    LEFT JOIN legacy."Addresses" a ON a."Id" = x."HomeAddressId"
),
p AS (
  SELECT l.*, n.id AS nid, n.deleted_at IS NOT NULL AS n_del, n.is_active AS n_active,
         n.name AS n_name, n.gender AS n_gender, n.email AS n_email, n.mobile_whatsapp AS n_mobile,
         n.cpf AS n_cpf, n.phone AS n_phone, n.birth_date AS n_birth, n.is_baptized AS n_baptized,
         n.baptism_date AS n_baptism, n.is_pastor AS n_pastor, n.notes AS n_notes,
         ROW(n.street, n.number, n.complement, n.neighborhood, n.city, n.state, n.zip_code)::text AS n_address,
         n.leader_id AS n_leader, ld.lid AS n_leader_lid, n.spouse_id AS n_spouse, sp.lid AS n_spouse_lid
    FROM lx l
    JOIN n ON n.legacy_id = l.lid
    LEFT JOIN idmap ld ON ld.id = n.leader_id
    LEFT JOIN idmap sp ON sp.id = n.spouse_id
)
SELECT 'diff'::text AS kind, 'member_missing'::text AS code, l.lid::bigint AS lid, NULL::text AS ref,
       CASE WHEN l.del THEN 'excluído no legado' END AS detail,
       nullif(concat_ws(',',
         CASE WHEN l.name IS NULL THEN CASE WHEN l.del THEN 'member_deleted_name_empty' ELSE 'member_name_empty' END END,
         CASE WHEN l.gender IS NULL THEN CASE WHEN l.del THEN 'member_deleted_gender_invalid' ELSE 'member_gender_invalid' END END
       ), '') AS expected,
       NULL::jsonb AS data
  FROM lx l
 WHERE NOT EXISTS (SELECT 1 FROM n WHERE n.legacy_id = l.lid)
UNION ALL
SELECT 'diff', 'member_extra', n.legacy_id, n.id::text,
       CASE WHEN n.deleted_at IS NOT NULL THEN 'excluído no novo' END, NULL, NULL
  FROM n
 WHERE NOT EXISTS (SELECT 1 FROM legacy."Members" x WHERE x."Id" = n.legacy_id)
UNION ALL
SELECT 'diff', 'member_status', p.lid, NULL,
       concat_ws('; ',
         CASE WHEN p.del <> p.n_del THEN format('excluído: legado %s, novo %s',
           CASE WHEN p.del THEN 'sim' ELSE 'não' END, CASE WHEN p.n_del THEN 'sim' ELSE 'não' END) END,
         CASE WHEN p.active <> p.n_active THEN format('ativo: legado %s, novo %s',
           CASE WHEN p.active THEN 'sim' ELSE 'não' END, CASE WHEN p.n_active THEN 'sim' ELSE 'não' END) END),
       NULL, NULL
  FROM p
 WHERE p.del <> p.n_del OR p.active <> p.n_active
UNION ALL
SELECT 'diff', 'member_field', p.lid, NULL, 'campo: ' || f.field, f.exp, NULL
  FROM p
 CROSS JOIN LATERAL (VALUES
    ('nome', p.name, p.n_name, NULL::text),
    ('sexo', p.gender, p.n_gender, NULL),
    ('e-mail', p.email, p.n_email,
     CASE WHEN p.n_email IS NULL THEN concat_ws(',',
       CASE WHEN NOT coalesce(public.is_valid_email(p.email) AND NOT public.is_placeholder_email(p.email), false)
            THEN 'member_email_dropped' END,
       'member_email_duplicate') END),
    ('celular', p.mobile, p.n_mobile, CASE WHEN p.n_mobile IS NULL THEN 'member_mobile_duplicate' END),
    ('CPF', p.cpf, p.n_cpf,
     CASE WHEN p.n_cpf IS NULL THEN concat_ws(',',
       CASE WHEN NOT coalesce(public.is_valid_cpf(p.cpf), false) THEN 'member_cpf_dropped' END,
       'member_cpf_duplicate') END),
    ('telefone', p.phone, p.n_phone, NULL),
    ('nascimento', p.birth_date::text, p.n_birth::text, NULL),
    ('batizado', p.is_baptized::text, p.n_baptized::text, NULL),
    ('data do batismo', p.baptism_date::text, p.n_baptism::text,
     CASE WHEN p.n_baptism IS NULL AND NOT p.is_baptized THEN 'member_baptism_date_dropped' END),
    ('pastor', p.exp_pastor::text, p.n_pastor::text, NULL),
    ('observações', p.notes, p.n_notes, NULL),
    ('endereço', p.address, p.n_address, NULL)
 ) f(field, lv, nv, exp)
 WHERE f.lv IS DISTINCT FROM f.nv
UNION ALL
SELECT 'diff', 'member_leader', p.lid, NULL,
       format('líder: legado %s, novo %s', coalesce(p.leader_raw::text, 'nenhum'),
              coalesce(p.n_leader_lid::text, CASE WHEN p.n_leader IS NULL THEN 'nenhum' ELSE 'cadastro só do novo' END)),
       CASE WHEN p.n_leader IS NULL AND p.leader_raw IS NOT NULL THEN concat_ws(',',
         CASE WHEN p.no_leadership THEN 'member_no_leadership_with_leader' END,
         CASE WHEN p.leader_raw = p.lid THEN CASE WHEN p.del THEN 'member_leader_self_deleted' ELSE 'member_leader_self' END END,
         CASE WHEN NOT EXISTS (SELECT 1 FROM public.members x WHERE x.legacy_id = p.leader_raw) THEN 'member_leader_missing' END,
         'member_leader_cycle') END,
       NULL
  FROM p
 WHERE p.leader_raw IS DISTINCT FROM p.n_leader_lid OR (p.n_leader IS NOT NULL AND p.n_leader_lid IS NULL)
UNION ALL
SELECT 'diff', 'member_spouse', p.lid, NULL,
       format('cônjuge: legado %s, novo %s', coalesce(p.spouse_raw::text, 'nenhum'),
              coalesce(p.n_spouse_lid::text, CASE WHEN p.n_spouse IS NULL THEN 'nenhum' ELSE 'cadastro só do novo' END)),
       CASE WHEN p.n_spouse IS NULL AND p.spouse_raw IS NOT NULL
            THEN 'member_spouse_dropped,member_spouse_not_reciprocal' END,
       NULL
  FROM p
 WHERE p.spouse_raw IS DISTINCT FROM p.n_spouse_lid OR (p.n_spouse IS NOT NULL AND p.n_spouse_lid IS NULL)
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', c.n)
  FROM (VALUES ('member_missing', (SELECT count(*) FROM lx)),
               ('member_extra', (SELECT count(*) FROM n)),
               ('member_status', (SELECT count(*) FROM p)),
               ('member_field', (SELECT count(*) FROM p)),
               ('member_leader', (SELECT count(*) FROM p)),
               ('member_spouse', (SELECT count(*) FROM p))) c(code, n)
ORDER BY 1, 2, 3, 4, 5;
