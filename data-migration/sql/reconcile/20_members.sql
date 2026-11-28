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
-- Os motivos da carga que desfazem um valor (repetido, ciclo, cônjuge) são conferidos aqui contra
-- o legado, pela regra da carga, e não só pela lista dela (um falso aprovado é o pior erro):
--   *_duplicate  outro membro do legado não excluído e incluído, com Id menor, tem o mesmo valor
--                normalizado (o celular pela chave do 9º dígito), e o menor (o que fica) ficou com ele
--   leader_cycle o líder efetivo do legado (as regras anteriores da carga aplicadas) fecha um ciclo
--                que volta ao membro, e o membro é o menor Id do ciclo (onde a carga quebra)
--   spouse_*     o vínculo não é recíproco ou não é entre dois não excluídos que entram (DEL-05), e
--                o motivo é o que a carga daria
-- =============================================================================
WITH RECURSIVE /*BASE*/,
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
),
-- Repetidos (a regra da carga: só entre não excluídos incluídos, com o valor válido; fica o menor Id).
inc AS (SELECT l.* FROM lx l WHERE NOT l.del AND l.name IS NOT NULL AND l.gender IS NOT NULL),
dup_email AS (
  SELECT g.email, g.keeper,
         EXISTS (SELECT 1 FROM public.members k WHERE k.legacy_id = g.keeper AND public.normalize_email(k.email) = g.email) AS kept
    FROM (SELECT i.email, min(i.lid) AS keeper FROM inc i
           WHERE coalesce(public.is_valid_email(i.email) AND NOT public.is_placeholder_email(i.email), false)
           GROUP BY i.email HAVING count(*) > 1) g
),
dup_cpf AS (
  SELECT g.cpf, g.keeper,
         EXISTS (SELECT 1 FROM public.members k WHERE k.legacy_id = g.keeper AND public.normalize_digits(k.cpf) = g.cpf) AS kept
    FROM (SELECT i.cpf, min(i.lid) AS keeper FROM inc i WHERE coalesce(public.is_valid_cpf(i.cpf), false)
           GROUP BY i.cpf HAVING count(*) > 1) g
),
-- Celular: a chave custa caro por chamada; só para quem perdeu o celular e para quem tem o mesmo
-- final de 8 dígitos (a chave mantém os 8 últimos).
mob_cand AS (
  SELECT p.lid, p.mobile, public.mobile_match_key(p.mobile) AS mkey
    FROM p WHERE p.n_mobile IS NULL AND p.mobile IS NOT NULL AND NOT p.del
),
dup_mobile AS (
  SELECT c.lid, min(i.lid) AS keeper, c.mkey
    FROM mob_cand c JOIN inc i ON right(i.mobile, 8) = right(c.mobile, 8)
   WHERE c.mkey IS NOT NULL AND public.mobile_match_key(i.mobile) = c.mkey
   GROUP BY c.lid, c.mkey HAVING count(*) > 1
),
dup_ok AS (
  SELECT p.lid,
         coalesce(NOT p.del AND de.keeper < p.lid AND de.kept, false) AS email_ok,
         coalesce(dm.keeper < p.lid AND EXISTS (SELECT 1 FROM public.members k WHERE k.legacy_id = dm.keeper
                                                  AND public.mobile_match_key(k.mobile_whatsapp) = dm.mkey), false) AS mobile_ok,
         coalesce(NOT p.del AND dc.keeper < p.lid AND dc.kept, false) AS cpf_ok
    FROM p
    LEFT JOIN dup_email de ON de.email = p.email AND p.n_email IS NULL
    LEFT JOIN dup_mobile dm ON dm.lid = p.lid
    LEFT JOIN dup_cpf dc ON dc.cpf = p.cpf AND p.n_cpf IS NULL
   WHERE p.n_email IS NULL OR p.n_mobile IS NULL OR p.n_cpf IS NULL
),
-- Líder efetivo no legado, com as regras da carga anteriores ao ciclo: "não tem liderança",
-- líder = a própria pessoa e líder inexistente ou de fora (nome ou sexo inválido) descartam.
leff AS (
  SELECT l.lid,
         CASE WHEN l.no_leadership OR l.leader_raw = l.lid OR k.lid IS NULL OR k.name IS NULL OR k.gender IS NULL
              THEN NULL ELSE l.leader_raw END AS eff
    FROM lx l LEFT JOIN lx k ON k.lid = l.leader_raw
   WHERE l.name IS NOT NULL AND l.gender IS NOT NULL
),
-- Só a partir de quem ficou sem líder no novo (poucos): a subida pelo líder efetivo.
cyc (origin, cur, path) AS (
  SELECT c.lid, e.eff, ARRAY[c.lid]
    FROM p c JOIN leff e ON e.lid = c.lid
   WHERE c.n_leader IS NULL AND c.leader_raw IS NOT NULL AND e.eff IS NOT NULL
  UNION ALL
  SELECT w.origin, e.eff, w.path || e.lid
    FROM cyc w JOIN leff e ON e.lid = w.cur
   WHERE e.eff IS NOT NULL AND NOT e.lid = ANY (w.path)
),
cycle_breakers AS (
  SELECT DISTINCT w.origin AS lid FROM cyc w
   WHERE w.cur = w.origin AND w.origin = (SELECT min(v) FROM unnest(w.path) v)
),
-- Cônjuge: o motivo que a carga daria para não ligar (nulo = a carga ligaria).
spouse_why AS (
  SELECT p.lid,
         CASE WHEN s."Id" IS NOT NULL AND public.normalize_person_name(s."Name") IS NOT NULL AND s."Gender" IN (0, 1)
                   AND NOT p.del AND NOT coalesce(s."IsDeleted", false) AND p.spouse_raw <> p.lid
              THEN CASE WHEN s."SpouseId" IS DISTINCT FROM p.lid THEN 'member_spouse_not_reciprocal' END
              ELSE 'member_spouse_dropped' END AS why
    FROM p LEFT JOIN legacy."Members" s ON s."Id" = p.spouse_raw
   WHERE p.n_spouse IS NULL AND p.spouse_raw IS NOT NULL
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
  LEFT JOIN dup_ok d ON d.lid = p.lid
 CROSS JOIN LATERAL (VALUES
    ('nome', p.name, p.n_name, NULL::text),
    ('sexo', p.gender, p.n_gender, NULL),
    ('e-mail', p.email, p.n_email,
     CASE WHEN p.n_email IS NULL THEN concat_ws(',',
       CASE WHEN NOT coalesce(public.is_valid_email(p.email) AND NOT public.is_placeholder_email(p.email), false)
            THEN 'member_email_dropped' END,
       CASE WHEN d.email_ok THEN 'member_email_duplicate' END) END),
    ('celular', p.mobile, p.n_mobile, CASE WHEN p.n_mobile IS NULL AND d.mobile_ok THEN 'member_mobile_duplicate' END),
    ('CPF', p.cpf, p.n_cpf,
     CASE WHEN p.n_cpf IS NULL THEN concat_ws(',',
       CASE WHEN NOT coalesce(public.is_valid_cpf(p.cpf), false) THEN 'member_cpf_dropped' END,
       CASE WHEN d.cpf_ok THEN 'member_cpf_duplicate' END) END),
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
         -- Inexistente ou de fora pelo legado (nome ou sexo inválido), não pelo novo.
         CASE WHEN NOT EXISTS (SELECT 1 FROM legacy."Members" x WHERE x."Id" = p.leader_raw
                                  AND public.normalize_person_name(x."Name") IS NOT NULL AND x."Gender" IN (0, 1))
              THEN 'member_leader_missing' END,
         CASE WHEN p.lid IN (SELECT b.lid FROM cycle_breakers b) THEN 'member_leader_cycle' END) END,
       NULL
  FROM p
 WHERE p.leader_raw IS DISTINCT FROM p.n_leader_lid OR (p.n_leader IS NOT NULL AND p.n_leader_lid IS NULL)
UNION ALL
SELECT 'diff', 'member_spouse', p.lid, NULL,
       format('cônjuge: legado %s, novo %s', coalesce(p.spouse_raw::text, 'nenhum'),
              coalesce(p.n_spouse_lid::text, CASE WHEN p.n_spouse IS NULL THEN 'nenhum' ELSE 'cadastro só do novo' END)),
       (SELECT w.why FROM spouse_why w WHERE w.lid = p.lid),
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
