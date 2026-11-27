-- =============================================================================
-- E4.06, passo 2: mapa legado → novo dos membros (DT-06), adoção (DT-09) e
-- conferências que dependem do mapa (conflito com cadastros do novo,
-- Administradores da DT-11). Nada é gravado aqui.
--
--   existing  members.legacy_id já preenchido (carga anterior ou adoção anterior)
--   adopted   cadastro do novo, sem legacy_id e não excluído, que coincide 1 para 1
--             por e-mail, celular (9º dígito conta como igual) ou CPF (Q-E4-1)
--   new       id novo
-- =============================================================================

CREATE TEMP TABLE member_map (
  lid integer PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  how text NOT NULL CHECK (how IN ('existing', 'adopted', 'new'))
) ON COMMIT DROP;

INSERT INTO member_map (lid, id, how)
SELECT l.lid, m.id, 'existing'
  FROM lm l JOIN public.members m ON m.legacy_id = l.lid
 WHERE l.included;

-- Coincidências com cadastros do novo (pelos índices únicos parciais do E2.04).
CREATE TEMP TABLE adopt_pairs ON COMMIT DROP AS
SELECT p.lid, p.id, array_agg(DISTINCT p.kind ORDER BY p.kind) AS kinds
  FROM (
    SELECT l.lid, n.id, 'e-mail' AS kind
      FROM lm l JOIN public.members n
        ON public.normalize_email(n.email) = l.email AND n.deleted_at IS NULL AND n.legacy_id IS NULL
     WHERE l.email IS NOT NULL AND l.included AND NOT l.del
    UNION ALL
    SELECT l.lid, n.id, 'celular'
      FROM lm l JOIN public.members n
        ON public.mobile_match_key(n.mobile_whatsapp) = l.mobile_key
       AND n.deleted_at IS NULL AND n.legacy_id IS NULL
     WHERE l.mobile_key IS NOT NULL AND l.included AND NOT l.del
    UNION ALL
    SELECT l.lid, n.id, 'CPF'
      FROM lm l JOIN public.members n
        ON public.normalize_digits(n.cpf) = l.cpf AND n.deleted_at IS NULL AND n.legacy_id IS NULL
     WHERE l.cpf IS NOT NULL AND l.included AND NOT l.del
  ) p
 WHERE NOT EXISTS (SELECT 1 FROM member_map mm WHERE mm.lid = p.lid)
 GROUP BY p.lid, p.id;

CREATE TEMP TABLE adopt_check ON COMMIT DROP AS
SELECT p.lid, p.id, p.kinds,
       count(*) OVER (PARTITION BY p.lid) AS per_legacy,
       count(*) OVER (PARTITION BY p.id) AS per_new
  FROM adopt_pairs p;

INSERT INTO load_issues
SELECT DISTINCT 'adoption_ambiguous', a.lid,
       CASE WHEN a.per_legacy > 1 THEN 'coincide com ' || a.per_legacy || ' cadastros do novo'
            ELSE 'o mesmo cadastro do novo coincide com os Ids: '
                 || (SELECT string_agg(b.lid::text, ', ' ORDER BY b.lid) FROM adopt_pairs b WHERE b.id = a.id) END
  FROM adopt_check a
 WHERE a.per_legacy > 1 OR a.per_new > 1;

INSERT INTO member_map (lid, id, how)
SELECT a.lid, a.id, 'adopted' FROM adopt_check a WHERE a.per_legacy = 1 AND a.per_new = 1;

INSERT INTO load_issues
SELECT 'member_adopted', a.lid, 'por: ' || array_to_string(a.kinds, ', ')
  FROM adopt_check a WHERE a.per_legacy = 1 AND a.per_new = 1;

INSERT INTO member_map (lid, id, how)
SELECT l.lid, gen_random_uuid(), 'new'
  FROM lm l
 WHERE l.included AND NOT EXISTS (SELECT 1 FROM member_map mm WHERE mm.lid = l.lid);

-- Identificador igual ao de um cadastro não excluído que fica fora desta carga
-- (do novo e não adotável, ou carregado antes e ausente agora): o índice único barraria.
CREATE TEMP TABLE outside_members ON COMMIT DROP AS
SELECT n.id, public.normalize_email(n.email) AS email, public.mobile_match_key(n.mobile_whatsapp) AS mobile_key,
       public.normalize_digits(n.cpf) AS cpf
  FROM public.members n
 WHERE n.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM member_map mm WHERE mm.id = n.id);

INSERT INTO load_issues
SELECT DISTINCT 'identifier_conflict_new', c.lid, 'campo: ' || c.field
  FROM (
    SELECT l.lid, 'e-mail' AS field FROM lm l JOIN outside_members n ON n.email = l.email
     WHERE l.included AND NOT l.del
    UNION ALL
    SELECT l.lid, 'celular' FROM lm l JOIN outside_members n ON n.mobile_key = l.mobile_key
     WHERE l.included AND NOT l.del
    UNION ALL
    SELECT l.lid, 'CPF' FROM lm l JOIN outside_members n ON n.cpf = l.cpf
     WHERE l.included AND NOT l.del
  ) c
 WHERE NOT EXISTS (SELECT 1 FROM adopt_pairs p WHERE p.lid = c.lid);

-- Carregados antes e ausentes agora (não são mexidos; a limpeza do PR 3 cuida).
INSERT INTO load_issues
SELECT 'member_stale', m.legacy_id, CASE WHEN l.lid IS NULL THEN 'não existe no legado' ELSE 'ficou de fora' END
  FROM public.members m LEFT JOIN lm l ON l.lid = m.legacy_id
 WHERE m.legacy_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM member_map mm WHERE mm.lid = m.legacy_id);

-- Administradores (DT-11, RN-18 c do E3) ---------------------------------------
-- Adotado = adotado agora ou numa carga anterior: fica com a função do cadastro do novo.
CREATE TEMP TABLE member_adopted ON COMMIT DROP AS
SELECT mm.lid, mm.id FROM member_map mm
 WHERE mm.how = 'adopted'
    OR EXISTS (SELECT 1 FROM legacy._load_adopted a WHERE a.member_id = mm.id);

CREATE TEMP TABLE admin_check ON COMMIT DROP AS
SELECT p.id AS lid, l.lid IS NOT NULL AS exists_, coalesce(l.included, false) AS included,
       coalesce(l.del, false) AS del,
       coalesce(public.member_has_login_identifier(l.email, l.mobile, l.cpf), false) AS has_identifier,
       EXISTS (SELECT 1 FROM member_adopted a WHERE a.lid = p.id) AS adopted
  FROM load_cfg cfg CROSS JOIN LATERAL unnest(cfg.admin_ids) p(id)
  LEFT JOIN lm l ON l.lid = p.id;

INSERT INTO load_issues
SELECT 'admin_config_invalid', a.lid,
       CASE WHEN NOT a.exists_ THEN 'não existe'
            WHEN NOT a.included THEN 'ficou de fora'
            WHEN a.del THEN 'excluído'
            ELSE 'sem identificador de login' END
  FROM admin_check a
 WHERE NOT (a.included AND NOT a.del AND a.has_identifier);

INSERT INTO load_issues
SELECT 'admin_adopted_keeps_role', a.lid,
       CASE WHEN m.role_id = (SELECT r.id FROM public.roles r WHERE r.is_system) THEN 'já é Administrador'
            ELSE 'não é Administrador no novo' END
  FROM admin_check a
  JOIN member_map mm ON mm.lid = a.lid
  JOIN public.members m ON m.id = mm.id
 WHERE a.adopted;

-- Quantos Administradores a carga deixa: os da lista (válidos, não adotados) e os
-- adotados que já são Administrador no novo, não excluídos e com identificador.
INSERT INTO load_issues
SELECT 'admins_below_minimum', NULL, 'Administradores: ' || n.total
  FROM (
    SELECT (SELECT count(*) FROM admin_check a
             WHERE a.included AND NOT a.del AND a.has_identifier AND NOT a.adopted)
         + (SELECT count(*) FROM member_adopted d
              JOIN lm l ON l.lid = d.lid
              JOIN public.members m ON m.id = d.id
             WHERE NOT l.del AND public.member_has_login_identifier(l.email, l.mobile, l.cpf)
               AND m.role_id = (SELECT r.id FROM public.roles r WHERE r.is_system)) AS total
  ) n
 WHERE n.total < 2;
