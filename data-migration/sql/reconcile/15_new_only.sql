-- =============================================================================
-- E4.09: registros sem legacy_id no novo (QA-RC-2). As outras verificações comparam só pelo
-- legacy_id; um registro sem ele (cadastrado no novo, ou uma carga que gravasse sem o Id) não
-- aparece em nenhuma delas. Aqui:
--   new_only_counts      (metric, informativa) membros, células e relatórios sem legacy_id, os
--                        criados antes do início da carga conferida (legítimos: cadastros do novo
--                        de antes da carga) e os criados durante ou depois dela
--   new_only_after_load  (attention, não reprova) cada registro sem legacy_id criado durante ou
--                        depois da carga conferida, pelo id do novo
--   new_only_duplicate   (compare, reprova) registro sem legacy_id, não excluído, cuja identidade
--                        coincide com a de um carregado cujo registro no legado não está excluído:
--                        membro pelo mesmo identificador normalizado (e-mail, celular pela chave do
--                        9º dígito, CPF; os valores válidos do legado), célula pelo mesmo líder,
--                        dia e horário, relatório pela mesma célula e semana. Depois de uma carga
--                        que terminou, não há caso legítimo: a adoção (DT-09) põe o legacy_id no
--                        cadastro coincidente, e os conflitos param a carga (identifier_conflict_new,
--                        report_week_conflict_new).
-- O lid é o Id do legado do carregado coincidente; a ref, o id do registro sem legacy_id.
-- =============================================================================
WITH /*BASE*/,
run AS (SELECT r.started_at FROM cfg JOIN legacy._load_runs r ON r.id = cfg.load_run),
nm AS (SELECT m.* FROM public.members m WHERE m.legacy_id IS NULL),
nc AS (SELECT c.* FROM public.cells c WHERE c.legacy_id IS NULL),
nr AS (SELECT r.* FROM public.cell_reports r WHERE r.legacy_id IS NULL),
allx AS (
  SELECT 1 AS ord, 'Membros' AS entity, nm.id, nm.created_at, nm.deleted_at FROM nm
  UNION ALL SELECT 2, 'Células', nc.id, nc.created_at, nc.deleted_at FROM nc
  UNION ALL SELECT 3, 'Relatórios', nr.id, nr.created_at, nr.deleted_at FROM nr
),
-- Identificadores dos sem legacy_id não excluídos.
nm_ids AS (
  SELECT nm.id, public.normalize_email(nm.email) AS email, public.mobile_match_key(nm.mobile_whatsapp) AS mkey,
         public.normalize_digits(nm.cpf) AS cpf
    FROM nm WHERE nm.deleted_at IS NULL
),
-- Membros do legado não excluídos e carregados, com os valores normalizados como na carga.
lmv AS (
  SELECT x."Id" AS lid, public.normalize_email(x."Email") AS email,
         coalesce(public.normalize_mobile(x."MobileNumber"), public.normalize_digits(x."MobileNumber")) AS mobile,
         public.normalize_digits(x."CPF") AS cpf
    FROM legacy."Members" x
   WHERE NOT coalesce(x."IsDeleted", false)
     AND EXISTS (SELECT 1 FROM public.members m WHERE m.legacy_id = x."Id")
),
member_dup AS (
  SELECT l.lid, n.id, 'e-mail' AS field
    FROM nm_ids n JOIN lmv l ON l.email = n.email
   WHERE n.email IS NOT NULL AND coalesce(public.is_valid_email(l.email) AND NOT public.is_placeholder_email(l.email), false)
  UNION ALL
  -- A chave mantém os 8 últimos dígitos: só esses candidatos pagam a chave do legado.
  SELECT l.lid, n.id, 'celular'
    FROM nm_ids n JOIN lmv l ON right(l.mobile, 8) = right(n.mkey, 8)
   WHERE n.mkey IS NOT NULL AND public.mobile_match_key(l.mobile) = n.mkey
  UNION ALL
  SELECT l.lid, n.id, 'CPF'
    FROM nm_ids n JOIN lmv l ON l.cpf = n.cpf
   WHERE n.cpf IS NOT NULL AND coalesce(public.is_valid_cpf(l.cpf), false)
),
cell_dup AS (
  SELECT l.legacy_id AS lid, n.id
    FROM nc n
    JOIN public.cells l ON l.legacy_id IS NOT NULL AND l.leader_id = n.leader_id
                       AND l.meeting_day = n.meeting_day AND l.meeting_time = n.meeting_time
    JOIN legacy."Cells" x ON x."Id" = l.legacy_id AND NOT coalesce(x."IsDeleted", false)
   WHERE n.deleted_at IS NULL
),
-- A semana do sem legacy_id calculada uma vez; a do carregado, pela faixa de datas (sem chamar
-- week_start por par).
nr_week AS (SELECT n.id, n.cell_id, public.week_start(n.date) AS ws FROM nr n WHERE n.deleted_at IS NULL),
report_dup AS (
  SELECT l.legacy_id AS lid, n.id
    FROM nr_week n
    JOIN public.cell_reports l ON l.legacy_id IS NOT NULL AND l.cell_id = n.cell_id
                              AND l.date BETWEEN n.ws AND n.ws + 6
    JOIN legacy."Reports" x ON x."Id" = l.legacy_id AND NOT coalesce(x."IsDeleted", false)
)
SELECT 'metric'::text AS kind, 'new_only_counts'::text AS code, NULL::bigint AS lid, e.ord || ':' || e.entity AS ref,
       NULL::text AS detail, NULL::text AS expected,
       jsonb_build_object('entity', e.entity,
         'before_load', count(a.id) FILTER (WHERE a.created_at < run.started_at),
         'after_load', count(a.id) FILTER (WHERE a.created_at IS NULL OR a.created_at >= run.started_at),
         'deleted', count(a.id) FILTER (WHERE a.deleted_at IS NOT NULL),
         'ok', NULL) AS data
  FROM (VALUES (1, 'Membros'), (2, 'Células'), (3, 'Relatórios')) e(ord, entity)
  CROSS JOIN run
  LEFT JOIN allx a ON a.ord = e.ord
 GROUP BY e.ord, e.entity, run.started_at
UNION ALL
SELECT 'item', 'new_only_after_load', NULL, a.id::text,
       concat_ws('; ', a.entity, 'criado durante ou depois da carga', CASE WHEN a.deleted_at IS NOT NULL THEN 'excluído' END),
       NULL, NULL
  FROM allx a CROSS JOIN run
 WHERE a.created_at IS NULL OR a.created_at >= run.started_at
UNION ALL
SELECT 'diff', 'new_only_duplicate', d.lid, 'membro sem Id do legado ' || d.id, 'mesmo ' || string_agg(DISTINCT d.field, ', '),
       NULL, NULL
  FROM member_dup d GROUP BY d.lid, d.id
UNION ALL
SELECT 'diff', 'new_only_duplicate', d.lid, 'célula sem Id do legado ' || d.id, 'mesmo líder, dia e horário', NULL, NULL
  FROM cell_dup d
UNION ALL
SELECT 'diff', 'new_only_duplicate', d.lid, 'relatório sem Id do legado ' || d.id, 'mesma célula e semana', NULL, NULL
  FROM report_dup d
UNION ALL
SELECT 'compared', 'new_only_duplicate', NULL, NULL, NULL, NULL,
       jsonb_build_object('n', (SELECT count(*) FROM allx WHERE allx.deleted_at IS NULL))
ORDER BY 1, 2, 3, 4, 5;
