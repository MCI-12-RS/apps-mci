-- =============================================================================
-- E4.06, passo 5: gravação (DT-06, 3 a 6), em replica: membros, células,
-- relatórios e participantes, por legacy_id, com ON CONFLICT. Refazer com o
-- mesmo legado não muda nenhuma linha (o DO UPDATE só regrava o que mudou).
-- Só roda se o script não achou nada que pare a carga.
-- =============================================================================

CREATE TEMP TABLE load_written (entity text NOT NULL, id uuid NOT NULL, inserted boolean NOT NULL) ON COMMIT DROP;

-- Membros ----------------------------------------------------------------------
CREATE TEMP TABLE member_rows ON COMMIT DROP AS
SELECT mm.id, l.lid AS legacy_id, l.name, l.email, l.cpf, l.gender, sp.id AS spouse_id, l.birth_date,
       l.mobile AS mobile_whatsapp, l.phone, l.notes, l.is_pastor, (l.leader_lid IS NOT NULL) AS has_leadership,
       ld.id AS leader_id, l.is_baptized, l.baptism_date, l.is_active,
       l.street, l.number, l.complement, l.neighborhood, l.city, l.state, l.zip_code,
       a.created_at, a.created_by_kind, a.created_by_legacy,
       a.updated_at, a.updated_by_kind, a.updated_by_legacy,
       -- Excluído sem data no legado: a data da carga, uma vez só (refazer mantém a primeira).
       CASE WHEN a.deleted_at = cfg.load_time AND cur.deleted_at IS NOT NULL THEN cur.deleted_at
            ELSE a.deleted_at END AS deleted_at,
       a.deleted_by_kind, a.deleted_by_legacy
  FROM lm l
  JOIN member_map mm ON mm.lid = l.lid
  LEFT JOIN member_map ld ON ld.lid = l.leader_lid
  LEFT JOIN member_map sp ON sp.lid = l.spouse_lid
  LEFT JOIN public.members cur ON cur.id = mm.id
 CROSS JOIN load_cfg cfg
 CROSS JOIN LATERAL private.legacy_authorship(l.created_by_raw, l.created_on, l.updated_by_raw, l.updated_on,
                                              l.del, cfg.load_time) a
 WHERE l.included;

-- Adoção (DT-09): a linha inteira do cadastro do novo vai antes para legacy._load_adopted
-- (a limpeza do PR 3 restaura dela); depois o cadastro recebe o legacy_id.
INSERT INTO legacy._load_adopted (member_id, legacy_id, before, run_id)
SELECT m.id, mm.lid, to_jsonb(m), current_setting('mci.load_run_id')::bigint
  FROM member_map mm JOIN public.members m ON m.id = mm.id
 WHERE mm.how = 'adopted'
ON CONFLICT DO NOTHING;

UPDATE public.members m SET legacy_id = mm.lid
  FROM member_map mm
 WHERE mm.how = 'adopted' AND m.id = mm.id;

-- Identificadores que mudam (ou cadastro que muda de situação) saem antes da
-- regravação, para uma troca entre dois carregados não esbarrar no índice único.
UPDATE public.members m SET email = NULL, mobile_whatsapp = NULL, cpf = NULL
  FROM member_rows r
 WHERE m.legacy_id = r.legacy_id
   AND (m.email IS NOT NULL OR m.mobile_whatsapp IS NOT NULL OR m.cpf IS NOT NULL)
   AND (m.email, m.mobile_whatsapp, m.cpf, m.deleted_at IS NULL)
       IS DISTINCT FROM (r.email, r.mobile_whatsapp, r.cpf, r.deleted_at IS NULL);

WITH up AS (
  INSERT INTO public.members AS m (
    id, legacy_id, name, email, cpf, gender, spouse_id, birth_date, mobile_whatsapp, phone, notes,
    is_pastor, has_leadership, leader_id, is_baptized, baptism_date, is_active,
    street, number, complement, neighborhood, city, state, zip_code,
    created_at, created_by, created_by_kind, created_by_legacy,
    updated_at, updated_by, updated_by_kind, updated_by_legacy,
    deleted_at, deleted_by, deleted_by_kind, deleted_by_legacy, role_id)
  -- A função padrão já no cadastro novo: o passo das funções (70) só regrava os
  -- Administradores e os G12 (DT-11). O DO UPDATE não mexe na função.
  SELECT id, legacy_id, name, email, cpf, gender, spouse_id, birth_date, mobile_whatsapp, phone, notes,
         is_pastor, has_leadership, leader_id, is_baptized, baptism_date, is_active,
         street, number, complement, neighborhood, city, state, zip_code,
         created_at, NULL, created_by_kind, created_by_legacy,
         updated_at, NULL, updated_by_kind, updated_by_legacy,
         deleted_at, NULL, deleted_by_kind, deleted_by_legacy,
         (SELECT r.id FROM public.roles r WHERE r.is_default)
    FROM member_rows
  ON CONFLICT (legacy_id) DO UPDATE SET
    name = EXCLUDED.name, email = EXCLUDED.email, cpf = EXCLUDED.cpf, gender = EXCLUDED.gender,
    spouse_id = EXCLUDED.spouse_id, birth_date = EXCLUDED.birth_date,
    mobile_whatsapp = EXCLUDED.mobile_whatsapp, phone = EXCLUDED.phone, notes = EXCLUDED.notes,
    is_pastor = EXCLUDED.is_pastor, has_leadership = EXCLUDED.has_leadership, leader_id = EXCLUDED.leader_id,
    is_baptized = EXCLUDED.is_baptized, baptism_date = EXCLUDED.baptism_date, is_active = EXCLUDED.is_active,
    street = EXCLUDED.street, number = EXCLUDED.number, complement = EXCLUDED.complement,
    neighborhood = EXCLUDED.neighborhood, city = EXCLUDED.city, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code,
    created_at = EXCLUDED.created_at, created_by = NULL, created_by_kind = EXCLUDED.created_by_kind,
    created_by_legacy = EXCLUDED.created_by_legacy,
    updated_at = EXCLUDED.updated_at, updated_by = NULL, updated_by_kind = EXCLUDED.updated_by_kind,
    updated_by_legacy = EXCLUDED.updated_by_legacy,
    deleted_at = EXCLUDED.deleted_at, deleted_by = NULL, deleted_by_kind = EXCLUDED.deleted_by_kind,
    deleted_by_legacy = EXCLUDED.deleted_by_legacy
  WHERE (m.name, m.email, m.cpf, m.gender, m.spouse_id, m.birth_date, m.mobile_whatsapp, m.phone, m.notes,
         m.is_pastor, m.has_leadership, m.leader_id, m.is_baptized, m.baptism_date, m.is_active,
         m.street, m.number, m.complement, m.neighborhood, m.city, m.state, m.zip_code,
         m.created_at, m.created_by, m.created_by_kind, m.created_by_legacy,
         m.updated_at, m.updated_by, m.updated_by_kind, m.updated_by_legacy,
         m.deleted_at, m.deleted_by, m.deleted_by_kind, m.deleted_by_legacy)
        IS DISTINCT FROM
        (EXCLUDED.name, EXCLUDED.email, EXCLUDED.cpf, EXCLUDED.gender, EXCLUDED.spouse_id, EXCLUDED.birth_date,
         EXCLUDED.mobile_whatsapp, EXCLUDED.phone, EXCLUDED.notes,
         EXCLUDED.is_pastor, EXCLUDED.has_leadership, EXCLUDED.leader_id, EXCLUDED.is_baptized,
         EXCLUDED.baptism_date, EXCLUDED.is_active,
         EXCLUDED.street, EXCLUDED.number, EXCLUDED.complement, EXCLUDED.neighborhood, EXCLUDED.city,
         EXCLUDED.state, EXCLUDED.zip_code,
         EXCLUDED.created_at, NULL::uuid, EXCLUDED.created_by_kind, EXCLUDED.created_by_legacy,
         EXCLUDED.updated_at, NULL::uuid, EXCLUDED.updated_by_kind, EXCLUDED.updated_by_legacy,
         EXCLUDED.deleted_at, NULL::uuid, EXCLUDED.deleted_by_kind, EXCLUDED.deleted_by_legacy)
  RETURNING m.id, (m.xmax = 0) AS inserted
)
INSERT INTO load_written SELECT 'members', id, inserted FROM up;

-- Cadastro do novo (fora da carga) cujo cônjuge é um carregado que, pelo legado,
-- não é cônjuge dele (adoção com outro cônjuge): o vínculo é desfeito do lado do novo.
CREATE TEMP TABLE spouse_unlinked ON COMMIT DROP AS
WITH u AS (
  UPDATE public.members n SET spouse_id = NULL
    FROM public.members s
   WHERE n.legacy_id IS NULL AND n.spouse_id = s.id AND s.legacy_id IS NOT NULL
     AND s.spouse_id IS DISTINCT FROM n.id
  RETURNING n.id
)
SELECT id FROM u;

-- Células -------------------------------------------------------------------------
WITH src AS (
  SELECT cm.id, l.lid AS legacy_id, l.leader_id, l.timothy_id, l.host_id, l.type, l.meeting_day, l.meeting_time,
         l.street, l.number, l.complement, l.neighborhood, l.city, l.state, l.zip_code,
         a.created_at, a.created_by_kind, a.created_by_legacy,
         a.updated_at, a.updated_by_kind, a.updated_by_legacy,
         CASE WHEN a.deleted_at = cfg.load_time AND cur.deleted_at IS NOT NULL THEN cur.deleted_at
              ELSE a.deleted_at END AS deleted_at,
         a.deleted_by_kind, a.deleted_by_legacy
    FROM lc l
    JOIN cell_map cm ON cm.lid = l.lid
    LEFT JOIN public.cells cur ON cur.id = cm.id
   CROSS JOIN load_cfg cfg
   CROSS JOIN LATERAL private.legacy_authorship(l.created_by_raw, l.created_on, l.updated_by_raw, l.updated_on,
                                                l.del, cfg.load_time) a
),
up AS (
  INSERT INTO public.cells AS c (
    id, legacy_id, leader_id, timothy_id, host_id, type, meeting_day, meeting_time, is_active,
    street, number, complement, neighborhood, city, state, zip_code,
    created_at, created_by, created_by_kind, created_by_legacy,
    updated_at, updated_by, updated_by_kind, updated_by_legacy,
    deleted_at, deleted_by, deleted_by_kind, deleted_by_legacy)
  SELECT id, legacy_id, leader_id, timothy_id, host_id, type, meeting_day, meeting_time, true,
         street, number, complement, neighborhood, city, state, zip_code,
         created_at, NULL, created_by_kind, created_by_legacy,
         updated_at, NULL, updated_by_kind, updated_by_legacy,
         deleted_at, NULL, deleted_by_kind, deleted_by_legacy
    FROM src
  ON CONFLICT (legacy_id) DO UPDATE SET
    leader_id = EXCLUDED.leader_id, timothy_id = EXCLUDED.timothy_id, host_id = EXCLUDED.host_id,
    type = EXCLUDED.type, meeting_day = EXCLUDED.meeting_day, meeting_time = EXCLUDED.meeting_time,
    is_active = EXCLUDED.is_active,
    street = EXCLUDED.street, number = EXCLUDED.number, complement = EXCLUDED.complement,
    neighborhood = EXCLUDED.neighborhood, city = EXCLUDED.city, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code,
    created_at = EXCLUDED.created_at, created_by = NULL, created_by_kind = EXCLUDED.created_by_kind,
    created_by_legacy = EXCLUDED.created_by_legacy,
    updated_at = EXCLUDED.updated_at, updated_by = NULL, updated_by_kind = EXCLUDED.updated_by_kind,
    updated_by_legacy = EXCLUDED.updated_by_legacy,
    deleted_at = EXCLUDED.deleted_at, deleted_by = NULL, deleted_by_kind = EXCLUDED.deleted_by_kind,
    deleted_by_legacy = EXCLUDED.deleted_by_legacy
  WHERE (c.leader_id, c.timothy_id, c.host_id, c.type, c.meeting_day, c.meeting_time, c.is_active,
         c.street, c.number, c.complement, c.neighborhood, c.city, c.state, c.zip_code,
         c.created_at, c.created_by, c.created_by_kind, c.created_by_legacy,
         c.updated_at, c.updated_by, c.updated_by_kind, c.updated_by_legacy,
         c.deleted_at, c.deleted_by, c.deleted_by_kind, c.deleted_by_legacy)
        IS DISTINCT FROM
        (EXCLUDED.leader_id, EXCLUDED.timothy_id, EXCLUDED.host_id, EXCLUDED.type, EXCLUDED.meeting_day,
         EXCLUDED.meeting_time, EXCLUDED.is_active,
         EXCLUDED.street, EXCLUDED.number, EXCLUDED.complement, EXCLUDED.neighborhood, EXCLUDED.city,
         EXCLUDED.state, EXCLUDED.zip_code,
         EXCLUDED.created_at, NULL::uuid, EXCLUDED.created_by_kind, EXCLUDED.created_by_legacy,
         EXCLUDED.updated_at, NULL::uuid, EXCLUDED.updated_by_kind, EXCLUDED.updated_by_legacy,
         EXCLUDED.deleted_at, NULL::uuid, EXCLUDED.deleted_by_kind, EXCLUDED.deleted_by_legacy)
  RETURNING c.id, (c.xmax = 0) AS inserted
)
INSERT INTO load_written SELECT 'cells', id, inserted FROM up;

-- Relatórios ----------------------------------------------------------------------
CREATE TEMP TABLE report_rows ON COMMIT DROP AS
SELECT rm.id, l.lid AS legacy_id, l.cell_id, l.date, l.time, l.was_held, l.theme, l.observations,
       l.reason_not_held, l.visitors, l.offering,
       l.snapshot_leader_id, l.snapshot_timothy_id, l.snapshot_host_id, l.snapshot_cell_type,
       a.created_at, a.created_by_kind, a.created_by_legacy,
       a.updated_at, a.updated_by_kind, a.updated_by_legacy,
       CASE WHEN l.dup_of IS NOT NULL                                      -- DT-08: excluído pelo sistema
              THEN CASE WHEN cur.deleted_by_kind = 'system' THEN cur.deleted_at ELSE cfg.load_time END
            WHEN a.deleted_at = cfg.load_time AND cur.deleted_at IS NOT NULL THEN cur.deleted_at
            ELSE a.deleted_at END AS deleted_at,
       CASE WHEN l.dup_of IS NOT NULL THEN 'system'::public.author_kind ELSE a.deleted_by_kind END AS deleted_by_kind,
       CASE WHEN l.dup_of IS NOT NULL THEN NULL ELSE a.deleted_by_legacy END AS deleted_by_legacy
  FROM lr l
  JOIN report_map rm ON rm.lid = l.lid
  LEFT JOIN public.cell_reports cur ON cur.id = rm.id
 CROSS JOIN load_cfg cfg
 CROSS JOIN LATERAL private.legacy_authorship(l.created_by_raw, l.created_on, l.updated_by_raw, l.updated_on,
                                              l.del, cfg.load_time) a
 WHERE l.included;

-- Relatório carregado que muda de célula, de semana ou passa a contar: sai do índice
-- da semana antes da regravação (fica excluído só até o DO UPDATE logo abaixo).
UPDATE public.cell_reports x SET deleted_at = cfg.load_time
  FROM report_rows r, load_cfg cfg
 WHERE x.legacy_id = r.legacy_id AND x.deleted_at IS NULL
   AND (x.cell_id, public.week_start(x.date), r.deleted_at IS NULL)
       IS DISTINCT FROM (r.cell_id, public.week_start(r.date), true);

WITH up AS (
  INSERT INTO public.cell_reports AS x (
    id, legacy_id, cell_id, date, time, was_held, theme, observations, reason_not_held, visitors, offering,
    snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type,
    created_at, created_by, created_by_kind, created_by_legacy,
    updated_at, updated_by, updated_by_kind, updated_by_legacy,
    deleted_at, deleted_by, deleted_by_kind, deleted_by_legacy)
  SELECT id, legacy_id, cell_id, date, time, was_held, theme, observations, reason_not_held, visitors, offering,
         snapshot_leader_id, snapshot_timothy_id, snapshot_host_id, snapshot_cell_type,
         created_at, NULL, created_by_kind, created_by_legacy,
         updated_at, NULL, updated_by_kind, updated_by_legacy,
         deleted_at, NULL, deleted_by_kind, deleted_by_legacy
    FROM report_rows
  ON CONFLICT (legacy_id) DO UPDATE SET
    cell_id = EXCLUDED.cell_id, date = EXCLUDED.date, time = EXCLUDED.time, was_held = EXCLUDED.was_held,
    theme = EXCLUDED.theme, observations = EXCLUDED.observations, reason_not_held = EXCLUDED.reason_not_held,
    visitors = EXCLUDED.visitors, offering = EXCLUDED.offering,
    snapshot_leader_id = EXCLUDED.snapshot_leader_id, snapshot_timothy_id = EXCLUDED.snapshot_timothy_id,
    snapshot_host_id = EXCLUDED.snapshot_host_id, snapshot_cell_type = EXCLUDED.snapshot_cell_type,
    created_at = EXCLUDED.created_at, created_by = NULL, created_by_kind = EXCLUDED.created_by_kind,
    created_by_legacy = EXCLUDED.created_by_legacy,
    updated_at = EXCLUDED.updated_at, updated_by = NULL, updated_by_kind = EXCLUDED.updated_by_kind,
    updated_by_legacy = EXCLUDED.updated_by_legacy,
    deleted_at = EXCLUDED.deleted_at, deleted_by = NULL, deleted_by_kind = EXCLUDED.deleted_by_kind,
    deleted_by_legacy = EXCLUDED.deleted_by_legacy
  WHERE (x.cell_id, x.date, x.time, x.was_held, x.theme, x.observations, x.reason_not_held, x.visitors, x.offering,
         x.snapshot_leader_id, x.snapshot_timothy_id, x.snapshot_host_id, x.snapshot_cell_type,
         x.created_at, x.created_by, x.created_by_kind, x.created_by_legacy,
         x.updated_at, x.updated_by, x.updated_by_kind, x.updated_by_legacy,
         x.deleted_at, x.deleted_by, x.deleted_by_kind, x.deleted_by_legacy)
        IS DISTINCT FROM
        (EXCLUDED.cell_id, EXCLUDED.date, EXCLUDED.time, EXCLUDED.was_held, EXCLUDED.theme, EXCLUDED.observations,
         EXCLUDED.reason_not_held, EXCLUDED.visitors, EXCLUDED.offering,
         EXCLUDED.snapshot_leader_id, EXCLUDED.snapshot_timothy_id, EXCLUDED.snapshot_host_id,
         EXCLUDED.snapshot_cell_type,
         EXCLUDED.created_at, NULL::uuid, EXCLUDED.created_by_kind, EXCLUDED.created_by_legacy,
         EXCLUDED.updated_at, NULL::uuid, EXCLUDED.updated_by_kind, EXCLUDED.updated_by_legacy,
         EXCLUDED.deleted_at, NULL::uuid, EXCLUDED.deleted_by_kind, EXCLUDED.deleted_by_legacy)
  RETURNING x.id, (x.xmax = 0) AS inserted
)
INSERT INTO load_written SELECT 'reports', id, inserted FROM up;

-- Participantes: o conjunto de cada relatório carregado passa a ser o do legado.
CREATE TEMP TABLE participants_removed ON COMMIT DROP AS
WITH d AS (
  DELETE FROM public.cell_report_participants p
   USING report_map rm
   WHERE p.report_id = rm.id
     AND NOT EXISTS (SELECT 1 FROM lp WHERE lp.report_id = p.report_id AND lp.member_id = p.member_id)
  RETURNING p.report_id
)
SELECT report_id FROM d;

WITH ins AS (
  INSERT INTO public.cell_report_participants (report_id, member_id)
  SELECT DISTINCT report_id, member_id FROM lp WHERE report_id IS NOT NULL AND member_id IS NOT NULL
  ON CONFLICT DO NOTHING
  RETURNING report_id
)
INSERT INTO load_written SELECT 'participants', report_id, true FROM ins;
