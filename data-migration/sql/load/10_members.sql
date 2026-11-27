-- =============================================================================
-- E4.06, passo 1: membros do legado transformados (pg_temp.lm), sem gravar nada.
--
-- Roda dentro da transação da carga (src/load.mjs), como postgres, em replica.
-- Parâmetros (set_config, só Ids do legado): mci.pastor_ids, mci.admin_ids.
-- Regras: 5.4 e 5.5 do docs/migracao.md; DT-07 e DT-12 do spec e4-carga.
-- As regras de e-mail, celular, CPF e nome são as funções do próprio banco.
-- Cada ocorrência vai para pg_temp.load_issues (código do catálogo
-- src/lib/load-codes.mjs, Id do legado e observação sem dado pessoal).
-- O ensaio e o --final rodam o mesmo SQL: o --final só para antes de gravar
-- se houver pendência "corrigir no legado" (o script decide pelo catálogo).
-- =============================================================================

CREATE TEMP TABLE load_cfg ON COMMIT DROP AS
SELECT coalesce(nullif(current_setting('mci.pastor_ids', true), ''), '{}')::int[] AS pastor_ids,
       coalesce(nullif(current_setting('mci.admin_ids', true), ''), '{}')::int[] AS admin_ids,
       now() AS load_time;

CREATE TEMP TABLE load_issues (code text NOT NULL, legacy_id integer, info text) ON COMMIT DROP;

-- Texto opcional: só o vazio ou só com espaços vira nulo (DT-24 do E2.04); o conteúdo não muda.
CREATE FUNCTION pg_temp.blank_null(_v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN _v ~ '^[[:space:]]*$' THEN NULL ELSE _v END $$;

-- Tira os espaços das pontas: o mesmo [[:space:]] (tab, quebra de linha…), com o NBSP
-- explícito (não depende do locale do banco). O btrim sem argumento só tira o espaço comum.
CREATE FUNCTION pg_temp.trim_space(_v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(_v, '^[[:space:]\u00a0]+|[[:space:]\u00a0]+$', '', 'g') $$;

-- Membros, com os valores lidos pelas regras do novo -------------------------
CREATE TEMP TABLE lm ON COMMIT DROP AS
SELECT x."Id" AS lid,
       coalesce(x."IsDeleted", false) AS del,
       public.normalize_person_name(x."Name") AS name,
       CASE x."Gender" WHEN 0 THEN 'M' WHEN 1 THEN 'F' END AS gender,
       public.normalize_email(x."Email") AS email_n,
       coalesce(public.normalize_mobile(x."MobileNumber"), public.normalize_digits(x."MobileNumber")) AS mobile,
       public.normalize_digits(x."CPF") AS cpf_n,
       public.normalize_digits(x."PhoneNumber") AS phone,
       x."BirthDate"::date AS birth_date,
       coalesce(x."Baptized", false) AS is_baptized,
       x."BaptismDate"::date AS baptism_date_raw,
       NOT coalesce(x."Idle", false) AS is_active,
       coalesce(x."HasNoLeadership", false) AS no_leadership,
       x."LeadershipId" AS leader_raw,
       x."SpouseId" AS spouse_raw,
       pg_temp.blank_null(x."Notes") AS notes,
       pg_temp.blank_null(a."Street") AS street,
       pg_temp.blank_null(a."Number") AS number,
       pg_temp.blank_null(a."Notes") AS complement,
       pg_temp.blank_null(a."Neighborhood") AS neighborhood,
       pg_temp.blank_null(a."City") AS city,
       upper(pg_temp.blank_null(btrim(a."State"))) AS state,
       public.normalize_digits(a."PostalCode") AS zip_code,
       x."CreatedBy" AS created_by_raw,
       x."CreationDate" AS created_on,
       x."LastModifiedBy" AS updated_by_raw,
       x."LastModifiedDate" AS updated_on,
       x."Id" = ANY (cfg.pastor_ids) AS in_pastor_list
  FROM legacy."Members" x
 CROSS JOIN load_cfg cfg
  LEFT JOIN legacy."Addresses" a ON a."Id" = x."HomeAddressId";

ALTER TABLE lm ADD PRIMARY KEY (lid);
ALTER TABLE lm
  ADD COLUMN included boolean NOT NULL DEFAULT false,
  ADD COLUMN email text,
  ADD COLUMN cpf text,
  ADD COLUMN baptism_date date,
  ADD COLUMN leader_lid integer,
  ADD COLUMN spouse_lid integer,
  ADD COLUMN is_pastor boolean NOT NULL DEFAULT false,
  ADD COLUMN mobile_key text;

-- Nome e sexo são obrigatórios, também para os excluídos: sem eles, o membro fica de fora.
UPDATE lm SET
  included = name IS NOT NULL AND gender IS NOT NULL,
  email = CASE WHEN coalesce(public.is_valid_email(email_n) AND NOT public.is_placeholder_email(email_n), false)
               THEN email_n END,
  cpf = CASE WHEN coalesce(public.is_valid_cpf(cpf_n), false) THEN cpf_n END,
  baptism_date = CASE WHEN is_baptized THEN baptism_date_raw END,
  leader_lid = CASE WHEN no_leadership THEN NULL ELSE leader_raw END,
  -- A chave do celular (9º dígito conta como igual) custa caro por chamada: calculada uma vez.
  mobile_key = public.mobile_match_key(mobile);

-- O não excluído é pendência "corrigir no legado" (o --final para); o excluído não pode ser
-- corrigido na tela do legado e só é listado (Q-E4-6).
INSERT INTO load_issues
SELECT CASE WHEN del THEN 'member_deleted_name_empty' ELSE 'member_name_empty' END, lid, NULL FROM lm WHERE name IS NULL
UNION ALL
SELECT CASE WHEN del THEN 'member_deleted_gender_invalid' ELSE 'member_gender_invalid' END, lid, NULL FROM lm
 WHERE gender IS NULL
UNION ALL
SELECT 'member_email_dropped', lid, CASE WHEN del THEN 'excluído' END FROM lm
 WHERE included AND email_n IS NOT NULL AND email IS NULL
UNION ALL
SELECT 'member_cpf_dropped', lid, CASE WHEN del THEN 'excluído' END FROM lm
 WHERE included AND cpf_n IS NOT NULL AND cpf IS NULL
UNION ALL
SELECT 'member_baptism_date_dropped', lid, CASE WHEN del THEN 'excluído' END FROM lm
 WHERE included AND NOT is_baptized AND baptism_date_raw IS NOT NULL
UNION ALL
SELECT 'member_no_leadership_with_leader', lid, CASE WHEN del THEN 'excluído' END FROM lm
 WHERE included AND no_leadership AND leader_raw IS NOT NULL
UNION ALL
-- Migram como estão (nenhum CHECK nem a member_rule_violations confere): a tela avisa na edição.
SELECT 'member_birth_out_of_range', lid,
       concat_ws('; ', public.birth_date_problem(birth_date, public.sp_today()), CASE WHEN del THEN 'excluído' END)
  FROM lm WHERE included AND public.birth_date_problem(birth_date, public.sp_today()) IS NOT NULL
UNION ALL
SELECT 'member_mobile_invalid_kept', lid, CASE WHEN del THEN 'excluído' END FROM lm
 WHERE included AND mobile IS NOT NULL AND public.normalize_mobile(mobile) IS NULL;

-- Identificador repetido entre não excluídos (índices únicos do E2.04): fica só no menor Id.
CREATE TEMP TABLE lm_dup ON COMMIT DROP AS
SELECT d.field, d.lid, d.keeper, d.n
  FROM (
    SELECT 'email' AS field, lid, min(lid) OVER w AS keeper, count(*) OVER w AS n
      FROM lm WHERE included AND NOT del AND email IS NOT NULL
    WINDOW w AS (PARTITION BY email)
    UNION ALL
    SELECT 'mobile', lid, min(lid) OVER w, count(*) OVER w
      FROM lm WHERE included AND NOT del AND mobile_key IS NOT NULL
    WINDOW w AS (PARTITION BY mobile_key)
    UNION ALL
    SELECT 'cpf', lid, min(lid) OVER w, count(*) OVER w
      FROM lm WHERE included AND NOT del AND cpf IS NOT NULL
    WINDOW w AS (PARTITION BY cpf)
  ) d
 WHERE d.n > 1;

INSERT INTO load_issues
SELECT 'member_' || field || '_duplicate', lid,
       CASE WHEN lid = keeper THEN 'fica com o valor' ELSE 'fica sem; o valor fica com: ' || keeper END
  FROM lm_dup;

UPDATE lm SET
  email  = CASE WHEN EXISTS (SELECT 1 FROM lm_dup d WHERE d.field = 'email'  AND d.lid = lm.lid AND d.lid <> d.keeper) THEN NULL ELSE email END,
  mobile = CASE WHEN EXISTS (SELECT 1 FROM lm_dup d WHERE d.field = 'mobile' AND d.lid = lm.lid AND d.lid <> d.keeper) THEN NULL ELSE mobile END,
  mobile_key = CASE WHEN EXISTS (SELECT 1 FROM lm_dup d WHERE d.field = 'mobile' AND d.lid = lm.lid AND d.lid <> d.keeper) THEN NULL ELSE mobile_key END,
  cpf    = CASE WHEN EXISTS (SELECT 1 FROM lm_dup d WHERE d.field = 'cpf'    AND d.lid = lm.lid AND d.lid <> d.keeper) THEN NULL ELSE cpf END
 WHERE lid IN (SELECT lid FROM lm_dup WHERE lid <> keeper);

INSERT INTO load_issues
SELECT 'member_without_identifier', lid, NULL FROM lm
 WHERE included AND NOT del AND NOT public.member_has_login_identifier(email, mobile, cpf);

-- Liderança ------------------------------------------------------------------
-- Líder = a própria pessoa (CHECK members_leader_not_self_check, também nos excluídos).
INSERT INTO load_issues
SELECT CASE WHEN del THEN 'member_leader_self_deleted' ELSE 'member_leader_self' END, lid, NULL
  FROM lm WHERE included AND leader_lid = lid;
UPDATE lm SET leader_lid = NULL WHERE included AND leader_lid = lid;

-- Líder que não existe ou ficou de fora: sem liderança.
INSERT INTO load_issues
SELECT 'member_leader_missing', m.lid,
       concat_ws('; ', 'líder: ' || m.leader_lid,
                 CASE WHEN l.lid IS NOT NULL THEN 'ficou de fora' END,
                 CASE WHEN m.del THEN 'excluído' END)
  FROM lm m LEFT JOIN lm l ON l.lid = m.leader_lid
 WHERE m.included AND m.leader_lid IS NOT NULL AND NOT coalesce(l.included, false);
UPDATE lm m SET leader_lid = NULL
 WHERE m.included AND m.leader_lid IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM lm l WHERE l.lid = m.leader_lid AND l.included);

-- Ciclos (inclusive entre excluídos: a regra do novo segue a cadeia toda): quebrados no menor Id.
CREATE TEMP TABLE lm_cycle ON COMMIT DROP AS
WITH RECURSIVE w (origin, cur, path) AS (
  SELECT lid, leader_lid, ARRAY[lid] FROM lm WHERE included AND leader_lid IS NOT NULL
  UNION ALL
  SELECT w.origin, e.leader_lid, w.path || e.lid
    FROM w JOIN lm e ON e.lid = w.cur
   WHERE e.leader_lid IS NOT NULL AND NOT e.lid = ANY (w.path)
)
SELECT origin AS lid, (SELECT min(v) FROM unnest(path) v) AS breaker
  FROM w WHERE cur = origin;

INSERT INTO load_issues
SELECT 'member_leader_cycle', c.lid,
       concat_ws('; ', CASE WHEN c.lid = c.breaker THEN 'quebrado aqui (fica sem liderança)'
                            ELSE 'ciclo quebrado em: ' || c.breaker END,
                 CASE WHEN m.del THEN 'excluído' END)
  FROM lm_cycle c JOIN lm m ON m.lid = c.lid;
UPDATE lm SET leader_lid = NULL WHERE lid IN (SELECT breaker FROM lm_cycle);

-- Pastores da D9: só pelo Id do legado, sem líder e sem "não tem liderança".
INSERT INTO load_issues
SELECT 'pastor_config_invalid', p.id,
       CASE WHEN m.lid IS NULL THEN 'não existe'
            WHEN NOT m.included THEN 'ficou de fora'
            WHEN m.del THEN 'excluído'
            WHEN m.no_leadership THEN 'marcado "não tem liderança"'
            ELSE 'tem líder' END
  FROM load_cfg cfg CROSS JOIN LATERAL unnest(cfg.pastor_ids) p(id)
  LEFT JOIN lm m ON m.lid = p.id
 WHERE m.lid IS NULL OR NOT m.included OR m.del OR m.no_leadership OR m.leader_raw IS NOT NULL;

UPDATE lm SET is_pastor = true
 WHERE in_pastor_list AND included AND NOT del AND NOT no_leadership AND leader_raw IS NULL;

INSERT INTO load_issues
SELECT 'member_no_leader_not_marked', lid, NULL FROM lm
 WHERE included AND NOT del AND NOT no_leadership AND leader_raw IS NULL AND NOT is_pastor
UNION ALL
SELECT 'member_leader_deleted', m.lid, 'líder excluído: ' || l.lid
  FROM lm m JOIN lm l ON l.lid = m.leader_lid
 WHERE m.included AND NOT m.del AND l.del;

-- Cônjuge: só o vínculo recíproco entre dois não excluídos que entram (DEL-05).
UPDATE lm m SET spouse_lid = m.spouse_raw
  FROM lm s
 WHERE s.lid = m.spouse_raw AND m.included AND s.included AND NOT m.del AND NOT s.del
   AND m.spouse_raw <> m.lid AND s.spouse_raw = m.lid;

INSERT INTO load_issues
SELECT CASE WHEN s.lid IS NOT NULL AND s.included AND NOT m.del AND NOT s.del AND m.spouse_raw <> m.lid
            THEN 'member_spouse_not_reciprocal' ELSE 'member_spouse_dropped' END,
       m.lid,
       concat_ws('; ', 'cônjuge: ' || m.spouse_raw,
                 CASE WHEN m.spouse_raw = m.lid THEN 'a própria pessoa'
                      WHEN s.lid IS NULL THEN 'não existe'
                      WHEN NOT s.included THEN 'ficou de fora'
                      WHEN m.del OR s.del THEN 'excluído'
                      ELSE 'o cônjuge aponta para: ' || coalesce(s.spouse_raw::text, 'ninguém') END)
  FROM lm m LEFT JOIN lm s ON s.lid = m.spouse_raw
 WHERE m.included AND m.spouse_raw IS NOT NULL AND m.spouse_lid IS NULL;
