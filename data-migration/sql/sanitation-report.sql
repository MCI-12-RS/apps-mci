-- =============================================================================
-- E4.04: relatório de saneamento sobre a cópia bruta (schema legacy).
--
-- Roda no próprio Supabase de destino, só com leitura, depois da cópia
-- (src/copy-raw.mjs). Usa as funções de regra do banco do novo (E2.04):
-- normalize_email, normalize_digits, normalize_mobile, mobile_match_key,
-- is_valid_cpf, is_valid_email, is_placeholder_email, normalize_person_name,
-- is_valid_person_name, member_has_login_identifier, birth_date_problem,
-- week_start e sp_today. Assim, o que o relatório aponta é o que a carga vai
-- encontrar nos CHECKs e nos índices únicos.
--
-- Parâmetro (opcional): mci.pastor_ids, os Ids do legado dos pastores da D9,
-- no formato de array do Postgres ('{1,2}'). O runner define com SET LOCAL.
--
-- Saída: dois comandos.
--   1. Contagens por tabela (ativos, inativos, excluídos).
--   2. Uma linha por verificação: ord, code, category, entity, title,
--      treatment, n (itens) e items (jsonb: [{id, info}]).
-- Nenhuma coluna de saída tem nome, e-mail, CPF ou telefone: só Ids do
-- legado e textos fixos.
--
-- Categorias:
--   legado         corrigir no legado, pela liderança (E4.05)
--   transformacao  tratado automaticamente na transformação (E4.06)
--   decidir        sem regra no plano: precisa de decisão antes do E4.06
--   info           só informativo
-- =============================================================================

-- 1. Contagens --------------------------------------------------------------
SELECT t.entity, t.total, t.not_deleted, t.deleted, t.active, t.inactive
FROM (
  SELECT 1 AS ord, 'Members' AS entity, count(*) AS total,
         count(*) FILTER (WHERE NOT "IsDeleted") AS not_deleted,
         count(*) FILTER (WHERE "IsDeleted") AS deleted,
         count(*) FILTER (WHERE NOT "IsDeleted" AND NOT "Idle") AS active,
         count(*) FILTER (WHERE NOT "IsDeleted" AND "Idle") AS inactive
    FROM legacy."Members"
  UNION ALL
  SELECT 2, 'Cells', count(*), count(*) FILTER (WHERE NOT "IsDeleted"), count(*) FILTER (WHERE "IsDeleted"),
         NULL, NULL
    FROM legacy."Cells"
  UNION ALL
  SELECT 3, 'Reports', count(*), count(*) FILTER (WHERE NOT "IsDeleted"), count(*) FILTER (WHERE "IsDeleted"),
         NULL, NULL
    FROM legacy."Reports"
  UNION ALL
  -- Participantes: "não excluídos" são os de relatórios não excluídos.
  SELECT 4, 'ReportMembers', count(*),
         count(*) FILTER (WHERE r."IsDeleted" IS FALSE),
         count(*) FILTER (WHERE r."IsDeleted" IS TRUE),
         NULL, NULL
    FROM legacy."ReportMembers" rm LEFT JOIN legacy."Reports" r ON r."Id" = rm."ReportId"
  UNION ALL
  SELECT 5, 'Addresses', count(*), count(*) FILTER (WHERE NOT "IsDeleted"), count(*) FILTER (WHERE "IsDeleted"),
         NULL, NULL
    FROM legacy."Addresses"
) t
ORDER BY t.ord;

-- 2. Verificações -----------------------------------------------------------
WITH
cfg AS (
  SELECT coalesce(nullif(current_setting('mci.pastor_ids', true), ''), '{}')::int[] AS pastor_ids,
         public.sp_today() AS today
),
defs (ord, code, category, entity, title, treatment) AS (
  VALUES
  -- Membros: identificadores (E2.04, RN-04 a RN-09)
  (101, 'member_email_duplicate', 'legado', 'Members',
   'E-mail repetido entre membros não excluídos (sem diferenciar maiúsculas e espaços)',
   'Corrigir no legado (E4.05). Sem isso o índice único members_email_key barra a carga. O info diz com quem o e-mail se repete.'),
  (102, 'member_mobile_duplicate', 'legado', 'Members',
   'Celular repetido entre membros não excluídos (9º dígito conta como igual, RN-06 e RN-09)',
   'Corrigir no legado (E4.05). Sem isso o índice único members_mobile_key barra a carga.'),
  (103, 'member_cpf_duplicate', 'legado', 'Members',
   'CPF (válido) repetido entre membros não excluídos',
   'Corrigir no legado (E4.05). Sem isso o índice único members_cpf_key barra a carga.'),
  (104, 'member_cpf_invalid', 'transformacao', 'Members',
   'CPF inválido: fora dos 11 dígitos, dígitos verificadores errados ou todos iguais (RN-07)',
   'Importado como nulo (o CHECK members_cpf_check vale também para excluídos).'),
  (105, 'member_email_invalid', 'transformacao', 'Members',
   'E-mail fora do formato (RN-04)',
   'Importado como nulo; a conta usa o e-mail técnico (6.2).'),
  (106, 'member_email_placeholder', 'transformacao', 'Members',
   'E-mail num domínio fictício (RN-05)',
   'Importado como nulo; a conta usa o e-mail técnico (6.2).'),
  (107, 'member_mobile_invalid', 'info', 'Members',
   'Celular fora do formato (RN-06)',
   'Migra como está, só com dígitos, e não serve de login. O info marca quem não tem outro identificador.'),
  (108, 'member_mobile_invalid_only_identifier', 'legado', 'Members',
   'Celular fora do formato e sem e-mail nem CPF válidos (destaque da 5.4)',
   'Corrigir o celular no legado (E4.05); senão a pessoa migra sem conta de acesso.'),
  (109, 'member_without_identifier', 'info', 'Members',
   'Membro não excluído sem identificador real (e-mail válido, celular no formato ou CPF válido, RN-08)',
   'Migra sem conta de acesso.'),
  (110, 'member_without_password', 'info', 'Members',
   'Membro não excluído sem senha no legado',
   'Migra com conta, sem credencial legada; precisa de redefinição (6.4).'),
  -- Membros: nome, sexo, datas
  (120, 'member_name_empty', 'legado', 'Members',
   'Nome vazio (members.name é obrigatório, também para excluídos)',
   'Corrigir no legado (E4.05). Para os excluídos (info "excluído"), a transformação precisa de um nome substituto: decidir.'),
  (121, 'member_name_single_word', 'info', 'Members',
   'Nome com uma palavra só (RN-02)',
   'Migra como está, com os espaços ajustados.'),
  (122, 'member_gender_invalid', 'legado', 'Members',
   'Sexo fora de 0 (M) e 1 (F) (members.gender é obrigatório, também para excluídos)',
   'Corrigir no legado (E4.05). Para os excluídos, decidir na transformação.'),
  (123, 'member_birth_future', 'info', 'Members',
   'Nascimento no futuro',
   'Migra como está.'),
  (124, 'member_birth_too_old', 'info', 'Members',
   'Nascimento de 100 anos atrás ou mais',
   'Migra como está.'),
  (125, 'member_baptism_date_without_baptism', 'transformacao', 'Members',
   'Data de batismo preenchida sem "batizado"',
   'A data fica nula (CHECK members_baptism_check).'),
  (126, 'member_address_missing', 'transformacao', 'Members',
   'Endereço (HomeAddressId) que não existe em Addresses',
   'Migra sem endereço.'),
  -- Membros: liderança (D9, D10, E2.06)
  (140, 'pastor_config_invalid', 'decidir', 'Members',
   'Pastor da D9 configurado (LEGACY_PASTOR_IDS) que não existe, está excluído, tem líder ou está marcado "não tem liderança"',
   'Conferir os Ids em LEGACY_PASTOR_IDS.'),
  (141, 'member_no_leader_not_marked', 'legado', 'Members',
   'Sem líder e sem "não tem liderança", fora os pastores da D9',
   'A liderança indica o líder no legado (E4.05). Quem não for corrigido migra sem liderança. O info mostra quantos estão abaixo (ajuda a achar os pastores, se a D9 não estiver configurada).'),
  (142, 'member_no_leadership_with_disciples', 'legado', 'Members',
   'Sem liderança e com discípulos (P-HIE-02; no_leadership_with_disciples)',
   'A liderança indica o líder no legado (E4.05). Quem não for corrigido migra sem liderança, e a descendência conta o nível a partir dele.'),
  (143, 'member_no_leadership_with_leader', 'transformacao', 'Members',
   '"Não tem liderança" marcado, mas com líder preenchido',
   'O líder é descartado.'),
  (144, 'member_leader_missing', 'legado', 'Members',
   'Membro não excluído com líder que não existe',
   'Corrigir no legado (E4.05); senão migra sem liderança.'),
  (145, 'member_leader_deleted', 'legado', 'Members',
   'Membro não excluído com líder excluído (D10)',
   'Reatribuir o líder no legado (E4.05). O info diz o Id do líder excluído.'),
  (146, 'member_leadership_cycle', 'legado', 'Members',
   'Ciclo na hierarquia (a cadeia de líderes volta para a própria pessoa)',
   'Corrigir no legado (E4.05).'),
  -- Membros: cônjuge
  (160, 'member_spouse_self', 'transformacao', 'Members',
   'Cônjuge apontando para a própria pessoa',
   'O vínculo é desfeito.'),
  (161, 'member_spouse_missing', 'transformacao', 'Members',
   'Cônjuge que não existe',
   'O vínculo é desfeito (mesma regra do cônjuge excluído; confirmar).'),
  (162, 'member_spouse_deleted', 'transformacao', 'Members',
   'Membro não excluído com cônjuge excluído (DEL-05)',
   'O vínculo é desfeito.'),
  (163, 'member_spouse_not_reciprocal', 'legado', 'Members',
   'Cônjuge não recíproco entre membros não excluídos',
   'Corrigir no legado (E4.05). O info diz o cônjuge apontado e para quem ele aponta.'),
  -- Células
  (201, 'cell_time_invalid', 'legado', 'Cells',
   'Horário fora do formato HH:mm',
   'Corrigir no legado (E4.05). Para as excluídas (info "excluída"), o horário fica nulo na transformação.'),
  (202, 'cell_weekday_invalid', 'legado', 'Cells',
   'Dia da semana fora de 0 (domingo) a 6 (sábado)',
   'Corrigir no legado (E4.05).'),
  (203, 'cell_type_invalid', 'legado', 'Cells',
   'Tipo fora de 0 (Evangelística), 1 (Discipulado) e 2 (Macrocélula)',
   'Corrigir no legado (E4.05).'),
  (204, 'cell_person_missing', 'legado', 'Cells',
   'Célula não excluída com líder, timóteo ou anfitrião que não existe (D4: os três são obrigatórios)',
   'Corrigir no legado (E4.05).'),
  (205, 'cell_person_deleted', 'legado', 'Cells',
   'Célula não excluída com líder, timóteo ou anfitrião excluído (D10)',
   'Reatribuir no legado (E4.05).'),
  (206, 'cell_deleted_person_missing', 'transformacao', 'Cells',
   'Célula excluída com líder, timóteo ou anfitrião que não existe',
   'Migra excluída, com a referência nula.'),
  (207, 'cell_leader_inactive', 'info', 'Cells',
   'Célula não excluída liderada por membro inativo',
   'Migra como está; a célula não conta nos totais de ninguém (D2).'),
  (208, 'cell_place_missing', 'transformacao', 'Cells',
   'Endereço (PlaceId) que não existe em Addresses',
   'Migra sem endereço.'),
  -- Relatórios
  (301, 'report_duplicate_week', 'transformacao', 'Reports',
   'Mais de um relatório não excluído da mesma célula na mesma semana (domingo a sábado)',
   'Fica o mais recente (maior data; no empate, maior Id); os outros migram como excluídos (índice cell_reports_cell_week_key). Listar para a liderança.'),
  (302, 'report_cell_missing', 'decidir', 'Reports',
   'Relatório de célula que não existe',
   'Sem regra no plano: cell_id é obrigatório no novo. Decidir (não migrar e listar no relatório de carga?).'),
  (303, 'report_date_missing', 'decidir', 'Reports',
   'Relatório sem data (nula, ou data zero do MySQL convertida em nulo na cópia)',
   'Sem regra no plano: date e time são obrigatórios no novo. Decidir.'),
  (304, 'report_snapshot_person_missing', 'decidir', 'Reports',
   'Relatório com líder, timóteo ou anfitrião (snapshot) que não existe',
   'Decidir no E4.02/E4.06: snapshot nulo?'),
  (305, 'report_cell_type_invalid', 'decidir', 'Reports',
   'Tipo da célula no relatório fora de 0, 1 e 2',
   'Decidir no E4.06: snapshot do tipo nulo?'),
  (306, 'report_future_date', 'info', 'Reports',
   'Relatório com data no futuro',
   'Migra como está.'),
  (307, 'report_num_members_mismatch', 'info', 'Reports',
   'NumMembers diferente do número de participantes gravados',
   'Base da reconciliação (5.6): a diferença esperada fica listada aqui.'),
  (308, 'report_num_visitors_mismatch', 'info', 'Reports',
   'NumVisitors diferente do número de visitantes com nome',
   'Base da reconciliação (5.6).'),
  (309, 'report_contribution_rounding', 'info', 'Reports',
   'Oferta com mais de 2 casas decimais ou negativa',
   'Arredondada para 2 casas na transformação.'),
  (310, 'report_cell_deleted', 'info', 'Reports',
   'Relatório não excluído de célula excluída',
   'Migra como está, com a referência mantida (5.4).'),
  -- Participantes
  (401, 'participant_member_missing', 'transformacao', 'ReportMembers',
   'Participante que não existe em Members (Id = relatório; info = membro)',
   'Não migra; entra no relatório de carga (5.5).'),
  (402, 'participant_report_missing', 'transformacao', 'ReportMembers',
   'Participante de relatório que não existe (Id = relatório; info = membro)',
   'Não migra; entra no relatório de carga (5.5).'),
  (403, 'participant_member_deleted', 'info', 'ReportMembers',
   'Membro excluído como participante de relatório não excluído (Id = relatório; info = membro)',
   'Migra; o participante excluído é preservado (E2.01).')
),
-- Membros com os valores lidos pelas regras do novo
m AS (
  SELECT x."Id" AS id,
         x."IsDeleted" AS del,
         x."Idle" AS idle,
         x."Gender" AS gender,
         x."LeadershipId" AS leader,
         x."SpouseId" AS spouse,
         x."HasNoLeadership" AS no_leadership,
         x."HomeAddressId" AS address_id,
         x."Baptized" AS baptized,
         x."BaptismDate" AS baptism_date,
         public.normalize_person_name(x."Name") AS name_n,
         coalesce(public.is_valid_person_name(x."Name"), false) AS name_ok,
         public.normalize_email(x."Email") AS email_n,
         public.normalize_digits(x."MobileNumber") AS mobile_digits,
         public.normalize_mobile(x."MobileNumber") AS mobile_n,
         public.mobile_match_key(x."MobileNumber") AS mobile_key,
         public.normalize_digits(x."CPF") AS cpf_d,
         public.birth_date_problem(x."BirthDate"::date, cfg.today) AS birth_problem,
         public.member_has_login_identifier(x."Email", x."MobileNumber", x."CPF") AS has_identifier,
         nullif(btrim(coalesce(x."Password", '')), '') IS NULL AS no_password,
         x."Id" = ANY (cfg.pastor_ids) AS is_pastor
    FROM legacy."Members" x CROSS JOIN cfg
),
me AS (
  SELECT m.*,
         coalesce(m.email_n IS NOT NULL AND public.is_valid_email(m.email_n)
                  AND NOT public.is_placeholder_email(m.email_n), false) AS email_ok,
         coalesce(public.is_valid_cpf(m.cpf_d), false) AS cpf_ok,
         -- Líder que a transformação usa: "não tem liderança" descarta o líder
         CASE WHEN m.no_leadership THEN NULL ELSE m.leader END AS eff_leader
    FROM m
),
-- Situação do líder efetivo de cada membro
ml AS (
  SELECT me.*, l.id AS l_id, l.del AS l_del
    FROM me LEFT JOIN me l ON l.id = me.eff_leader
),
-- Sem liderança no novo: não é pastor e não tem líder que exista
no_top AS (
  SELECT ml.* FROM ml
   WHERE NOT ml.del AND NOT ml.is_pastor AND (ml.eff_leader IS NULL OR ml.l_id IS NULL)
),
-- Descendentes não excluídos de cada membro sem líder (para o info)
descendants AS (
  WITH RECURSIVE d (root, id) AS (
    SELECT r.id, c.id FROM me r JOIN me c ON c.eff_leader = r.id AND NOT c.del
     WHERE NOT r.del AND r.eff_leader IS NULL
    UNION ALL
    SELECT d.root, c.id FROM d JOIN me c ON c.eff_leader = d.id AND NOT c.del
  ) CYCLE id SET is_cycle USING path
  SELECT root, count(DISTINCT id) AS n FROM d WHERE NOT is_cycle GROUP BY root
),
-- Membros em ciclo de liderança (inclui excluídos: a cadeia do novo também os segue)
cycle_walk AS (
  WITH RECURSIVE w (origin, cur, path) AS (
    SELECT me.id, me.eff_leader, ARRAY[me.id] FROM me WHERE me.eff_leader IS NOT NULL
    UNION ALL
    SELECT w.origin, e.eff_leader, w.path || e.id
      FROM w JOIN me e ON e.id = w.cur
     WHERE e.eff_leader IS NOT NULL AND NOT e.id = ANY (w.path)
  )
  SELECT DISTINCT origin AS id FROM w WHERE cur = origin
),
cells AS (
  SELECT c."Id" AS id, c."IsDeleted" AS del, c."LeadId" AS lead_id, c."TimothyId" AS timothy_id,
         c."HostId" AS host_id, c."WeekDay" AS weekday, c."Time" AS time_text, c."CellType" AS cell_type,
         c."PlaceId" AS place_id
    FROM legacy."Cells" c
),
cell_people AS (
  SELECT c.id, c.del, p.role, p.member_id, mm.id IS NOT NULL AS exists_, coalesce(mm.del, false) AS member_del,
         coalesce(mm.idle, false) AS member_idle
    FROM cells c
   CROSS JOIN LATERAL (VALUES ('líder', c.lead_id), ('timóteo', c.timothy_id), ('anfitrião', c.host_id)) p(role, member_id)
    LEFT JOIN me mm ON mm.id = p.member_id
),
reports AS (
  SELECT r."Id" AS id, r."IsDeleted" AS del, r."CellId" AS cell_id, r."Date" AS date_,
         r."NumMembers" AS num_members, r."NumVisitors" AS num_visitors, r."Visitors" AS visitors,
         r."Contribution" AS contribution, r."CellType" AS cell_type,
         r."LeadershipId" AS lead_id, r."HostId" AS host_id, r."TimothyId" AS timothy_id
    FROM legacy."Reports" r
),
participants AS (
  SELECT rm."ReportId" AS report_id, rm."MemberId" AS member_id FROM legacy."ReportMembers" rm
),
dup_email AS (
  SELECT email_n AS k, array_agg(id ORDER BY id) AS ids FROM me
   WHERE NOT del AND email_ok GROUP BY email_n HAVING count(*) > 1
),
dup_mobile AS (
  SELECT mobile_key AS k, array_agg(id ORDER BY id) AS ids FROM me
   WHERE NOT del AND mobile_key IS NOT NULL GROUP BY mobile_key HAVING count(*) > 1
),
dup_cpf AS (
  SELECT cpf_d AS k, array_agg(id ORDER BY id) AS ids FROM me
   WHERE NOT del AND cpf_ok GROUP BY cpf_d HAVING count(*) > 1
),
dup_report AS (
  SELECT array_agg(id ORDER BY date_ DESC, id DESC) AS ids, array_agg(id ORDER BY id) AS sorted_ids FROM reports
   WHERE NOT del AND date_ IS NOT NULL
   GROUP BY cell_id, public.week_start(date_::date) HAVING count(*) > 1
),
hits (code, id, info) AS (
  -- Identificadores
  SELECT 'member_email_duplicate', u.id, 'grupo: ' || array_to_string(g.ids, ', ')
    FROM dup_email g CROSS JOIN LATERAL unnest(g.ids) u(id)
  UNION ALL
  SELECT 'member_mobile_duplicate', u.id, 'grupo: ' || array_to_string(g.ids, ', ')
    FROM dup_mobile g CROSS JOIN LATERAL unnest(g.ids) u(id)
  UNION ALL
  SELECT 'member_cpf_duplicate', u.id, 'grupo: ' || array_to_string(g.ids, ', ')
    FROM dup_cpf g CROSS JOIN LATERAL unnest(g.ids) u(id)
  UNION ALL
  SELECT 'member_cpf_invalid', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE cpf_d IS NOT NULL AND NOT cpf_ok
  UNION ALL
  SELECT 'member_email_invalid', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE email_n IS NOT NULL AND NOT coalesce(public.is_valid_email(email_n), false)
  UNION ALL
  SELECT 'member_email_placeholder', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE public.is_placeholder_email(email_n)
  UNION ALL
  SELECT 'member_mobile_invalid', id,
         concat_ws('; ', CASE WHEN del THEN 'excluído' END,
                   CASE WHEN NOT email_ok AND NOT cpf_ok THEN 'único identificador' END)
    FROM me WHERE mobile_digits IS NOT NULL AND mobile_n IS NULL
  UNION ALL
  SELECT 'member_mobile_invalid_only_identifier', id, NULL FROM me
   WHERE NOT del AND mobile_digits IS NOT NULL AND mobile_n IS NULL AND NOT email_ok AND NOT cpf_ok
  UNION ALL
  SELECT 'member_without_identifier', id, NULL FROM me WHERE NOT del AND NOT has_identifier
  UNION ALL
  SELECT 'member_without_password', id, NULL FROM me WHERE NOT del AND no_password
  -- Nome, sexo, datas
  UNION ALL
  SELECT 'member_name_empty', id, CASE WHEN del THEN 'excluído' END FROM me WHERE name_n IS NULL
  UNION ALL
  SELECT 'member_name_single_word', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE name_n IS NOT NULL AND NOT name_ok
  UNION ALL
  SELECT 'member_gender_invalid', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE gender IS NULL OR gender NOT IN (0, 1)
  UNION ALL
  SELECT 'member_birth_future', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE birth_problem = 'birth_date_future'
  UNION ALL
  SELECT 'member_birth_too_old', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE birth_problem = 'birth_date_too_old'
  UNION ALL
  SELECT 'member_baptism_date_without_baptism', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE NOT baptized AND baptism_date IS NOT NULL
  UNION ALL
  SELECT 'member_address_missing', me.id, CASE WHEN me.del THEN 'excluído' END
    FROM me WHERE me.address_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM legacy."Addresses" a WHERE a."Id" = me.address_id)
  -- Liderança
  UNION ALL
  SELECT 'pastor_config_invalid', p.id,
         CASE WHEN me.id IS NULL THEN 'não existe'
              WHEN me.del THEN 'excluído'
              WHEN me.no_leadership THEN 'marcado "não tem liderança"'
              ELSE 'tem líder' END
    FROM cfg CROSS JOIN LATERAL unnest(cfg.pastor_ids) p(id)
    LEFT JOIN me ON me.id = p.id
   WHERE me.id IS NULL OR me.del OR me.no_leadership OR me.leader IS NOT NULL
  UNION ALL
  SELECT 'member_no_leader_not_marked', me.id, 'abaixo: ' || coalesce(d.n, 0)
    FROM me LEFT JOIN descendants d ON d.root = me.id
   WHERE NOT me.del AND NOT me.no_leadership AND me.leader IS NULL AND NOT me.is_pastor
  UNION ALL
  SELECT 'member_no_leadership_with_disciples', t.id,
         'discípulos: ' || (SELECT count(*) FROM me c WHERE c.eff_leader = t.id AND NOT c.del)
    FROM no_top t
   WHERE EXISTS (SELECT 1 FROM me c WHERE c.eff_leader = t.id AND NOT c.del)
  UNION ALL
  SELECT 'member_no_leadership_with_leader', id, CASE WHEN del THEN 'excluído' END FROM me
   WHERE no_leadership AND leader IS NOT NULL
  UNION ALL
  SELECT 'member_leader_missing', id, 'líder: ' || eff_leader FROM ml
   WHERE NOT del AND eff_leader IS NOT NULL AND l_id IS NULL
  UNION ALL
  SELECT 'member_leader_deleted', id, 'líder excluído: ' || eff_leader FROM ml
   WHERE NOT del AND l_del
  UNION ALL
  SELECT 'member_leadership_cycle', c.id, CASE WHEN me.del THEN 'excluído' END
    FROM cycle_walk c JOIN me ON me.id = c.id
  -- Cônjuge
  UNION ALL
  SELECT 'member_spouse_self', id, CASE WHEN del THEN 'excluído' END FROM me WHERE spouse = id
  UNION ALL
  SELECT 'member_spouse_missing', me.id, 'cônjuge: ' || me.spouse
    FROM me LEFT JOIN me s ON s.id = me.spouse
   WHERE me.spouse IS NOT NULL AND s.id IS NULL
  UNION ALL
  SELECT 'member_spouse_deleted', me.id, 'cônjuge excluído: ' || me.spouse
    FROM me JOIN me s ON s.id = me.spouse
   WHERE NOT me.del AND s.del AND me.spouse <> me.id
  UNION ALL
  SELECT 'member_spouse_not_reciprocal', me.id,
         'cônjuge: ' || me.spouse || '; o cônjuge aponta para: ' || coalesce(s.spouse::text, 'ninguém')
    FROM me JOIN me s ON s.id = me.spouse
   WHERE NOT me.del AND NOT s.del AND me.spouse <> me.id AND s.spouse IS DISTINCT FROM me.id
  -- Células
  UNION ALL
  SELECT 'cell_time_invalid', id, CASE WHEN del THEN 'excluída' END FROM cells
   WHERE coalesce(btrim(time_text), '') !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
  UNION ALL
  SELECT 'cell_weekday_invalid', id, CASE WHEN del THEN 'excluída' END FROM cells
   WHERE weekday IS NULL OR weekday NOT BETWEEN 0 AND 6
  UNION ALL
  SELECT 'cell_type_invalid', id, CASE WHEN del THEN 'excluída' END FROM cells
   WHERE cell_type IS NULL OR cell_type NOT IN (0, 1, 2)
  UNION ALL
  SELECT 'cell_person_missing', id, role || ': ' || coalesce(member_id::text, 'vazio') FROM cell_people
   WHERE NOT del AND NOT exists_
  UNION ALL
  SELECT 'cell_person_deleted', id, role || ' excluído: ' || member_id FROM cell_people
   WHERE NOT del AND member_del
  UNION ALL
  SELECT 'cell_deleted_person_missing', id, role || ': ' || coalesce(member_id::text, 'vazio') FROM cell_people
   WHERE del AND NOT exists_
  UNION ALL
  SELECT 'cell_leader_inactive', id, 'líder: ' || member_id FROM cell_people
   WHERE NOT del AND role = 'líder' AND exists_ AND NOT member_del AND member_idle
  UNION ALL
  SELECT 'cell_place_missing', c.id, CASE WHEN c.del THEN 'excluída' END FROM cells c
   WHERE c.place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM legacy."Addresses" a WHERE a."Id" = c.place_id)
  -- Relatórios
  UNION ALL
  SELECT 'report_duplicate_week', u.id,
         CASE WHEN u.ord = 1 THEN 'fica (o mais recente); grupo: ' ELSE 'vai como excluído; grupo: ' END
         || array_to_string(g.sorted_ids, ', ')
    FROM dup_report g CROSS JOIN LATERAL unnest(g.ids) WITH ORDINALITY u(id, ord)
  UNION ALL
  SELECT 'report_cell_missing', r.id, concat_ws('; ', 'célula: ' || r.cell_id, CASE WHEN r.del THEN 'excluído' END)
    FROM reports r WHERE NOT EXISTS (SELECT 1 FROM cells c WHERE c.id = r.cell_id)
  UNION ALL
  SELECT 'report_date_missing', id, CASE WHEN del THEN 'excluído' END FROM reports WHERE date_ IS NULL
  UNION ALL
  SELECT 'report_snapshot_person_missing', r.id, p.role || ': ' || coalesce(p.member_id::text, 'vazio')
    FROM reports r
   CROSS JOIN LATERAL (VALUES ('líder', r.lead_id), ('timóteo', r.timothy_id), ('anfitrião', r.host_id)) p(role, member_id)
   WHERE NOT EXISTS (SELECT 1 FROM me WHERE me.id = p.member_id)
  UNION ALL
  SELECT 'report_cell_type_invalid', id, 'tipo: ' || cell_type FROM reports
   WHERE cell_type IS NOT NULL AND cell_type NOT IN (0, 1, 2)
  UNION ALL
  SELECT 'report_future_date', r.id, CASE WHEN r.del THEN 'excluído' END
    FROM reports r CROSS JOIN cfg WHERE r.date_::date > cfg.today
  UNION ALL
  SELECT 'report_num_members_mismatch', r.id,
         'NumMembers: ' || coalesce(r.num_members::text, 'vazio') || '; participantes: ' || coalesce(p.n, 0)
    FROM reports r
    LEFT JOIN (SELECT report_id, count(*) AS n FROM participants GROUP BY report_id) p ON p.report_id = r.id
   WHERE NOT r.del AND coalesce(r.num_members, 0) <> coalesce(p.n, 0)
  UNION ALL
  SELECT 'report_num_visitors_mismatch', r.id,
         'NumVisitors: ' || coalesce(r.num_visitors::text, 'vazio') || '; com nome: ' || v.n
    FROM reports r
   CROSS JOIN LATERAL (
     SELECT count(*) AS n FROM regexp_split_to_table(coalesce(r.visitors, ''), '\|') s
      WHERE btrim(s) <> ''
   ) v
   WHERE NOT r.del AND coalesce(r.num_visitors, 0) <> v.n
  UNION ALL
  SELECT 'report_contribution_rounding', id, CASE WHEN contribution < 0 THEN 'negativa' END FROM reports
   WHERE contribution IS NOT NULL AND (contribution <> round(contribution, 2) OR contribution < 0)
  UNION ALL
  SELECT 'report_cell_deleted', r.id, 'célula: ' || r.cell_id
    FROM reports r JOIN cells c ON c.id = r.cell_id
   WHERE NOT r.del AND c.del
  -- Participantes
  UNION ALL
  SELECT 'participant_member_missing', p.report_id, 'membro: ' || p.member_id
    FROM participants p WHERE NOT EXISTS (SELECT 1 FROM me WHERE me.id = p.member_id)
  UNION ALL
  SELECT 'participant_report_missing', p.report_id, 'membro: ' || p.member_id
    FROM participants p WHERE NOT EXISTS (SELECT 1 FROM reports r WHERE r.id = p.report_id)
  UNION ALL
  SELECT 'participant_member_deleted', p.report_id, 'membro: ' || p.member_id
    FROM participants p
    JOIN reports r ON r.id = p.report_id AND NOT r.del
    JOIN me ON me.id = p.member_id AND me.del
)
SELECT d.ord, d.code, d.category, d.entity, d.title, d.treatment,
       count(h.code) AS n,
       coalesce(jsonb_agg(jsonb_build_object('id', h.id, 'info', nullif(h.info, '')) ORDER BY h.id, h.info)
                FILTER (WHERE h.code IS NOT NULL), '[]'::jsonb) AS items
  FROM defs d
  LEFT JOIN hits h ON h.code = d.code
 GROUP BY d.ord, d.code, d.category, d.entity, d.title, d.treatment
 ORDER BY d.ord;
