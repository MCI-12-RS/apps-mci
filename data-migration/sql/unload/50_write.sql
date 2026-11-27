-- =============================================================================
-- Limpeza do ensaio (DT-13), passo 2: gravação, em replica (sem FK, sem triggers de
-- usuário, sem Auditoria nem carimbo). Só roda se o plano não achou bloqueio.
-- As contas do Auth (ul_accounts) saem depois do commit, pela Admin API; aqui sai só o
-- cofre delas (private.account_passwords, que cairia em cascata).
-- =============================================================================

CREATE TEMP TABLE ul_counts (step text PRIMARY KEY, n bigint NOT NULL) ON COMMIT DROP;

-- Participantes (do relatório que sai ou de quem sai).
WITH d AS (
  DELETE FROM public.cell_report_participants p
   WHERE p.report_id IN (SELECT id FROM ul_reports) OR p.member_id IN (SELECT id FROM ul_members)
  RETURNING 1
)
INSERT INTO ul_counts SELECT 'participants_deleted', count(*) FROM d;

WITH d AS (DELETE FROM public.cell_reports x USING ul_reports r WHERE x.id = r.id RETURNING 1)
INSERT INTO ul_counts SELECT 'reports_deleted', count(*) FROM d;

WITH d AS (DELETE FROM private.cell_active_periods p USING ul_cells c WHERE p.cell_id = c.id RETURNING 1)
INSERT INTO ul_counts SELECT 'cell_periods_deleted', count(*) FROM d;

WITH d AS (DELETE FROM public.cells x USING ul_cells c WHERE x.id = c.id RETURNING 1)
INSERT INTO ul_counts SELECT 'cells_deleted', count(*) FROM d;

-- O que é de quem sai nas tabelas privadas. Do adotado, a credencial legada só sai junto com a
-- conta (o que não tinha conta antes da carga: before.auth_user_id nulo, ou a conta atual dele
-- em ul_accounts; PR3-2/PR4-3); a do adotado que fica com a conta não é tocada.
WITH d AS (
  DELETE FROM private.legacy_credentials c
   WHERE c.member_id IN (SELECT id FROM ul_members)
      OR c.member_id IN (SELECT a.member_id
                           FROM legacy._load_adopted a
                           JOIN public.members m ON m.id = a.member_id
                          WHERE a.before->>'auth_user_id' IS NULL
                             OR m.auth_user_id IN (SELECT id FROM ul_accounts))
  RETURNING 1
)
INSERT INTO ul_counts SELECT 'legacy_credentials_deleted', count(*) FROM d;

WITH d AS (DELETE FROM private.member_access_suspensions s USING ul_members t WHERE s.member_id = t.id RETURNING 1)
INSERT INTO ul_counts SELECT 'suspensions_deleted', count(*) FROM d;

WITH d AS (DELETE FROM private.account_passwords v USING ul_accounts a WHERE v.auth_user_id = a.id RETURNING 1)
INSERT INTO ul_counts SELECT 'vault_deleted', count(*) FROM d;

WITH u AS (
  UPDATE private.account_passwords v SET password_set_by = NULL
   WHERE v.password_set_by IN (SELECT id FROM ul_members)
  RETURNING 1
)
INSERT INTO ul_counts SELECT 'vault_set_by_cleared', count(*) FROM u;

WITH d AS (DELETE FROM private.member_hierarchy h USING ul_members t WHERE h.member_id = t.id RETURNING 1)
INSERT INTO ul_counts SELECT 'hierarchy_rows_deleted', count(*) FROM d;

WITH d AS (DELETE FROM public.members m USING ul_members t WHERE m.id = t.id RETURNING 1)
INSERT INTO ul_counts SELECT 'members_deleted', count(*) FROM d;

-- Adotados: a linha inteira de antes (legacy._load_adopted.before), com legacy_id nulo.
-- As colunas vêm do catálogo (todas as de members, menos id e as geradas); coluna que não
-- existia na adoção fica com o valor atual (jsonb_populate_record sobre a linha atual).
DO $do$
DECLARE
  _cols text;
  _vals text;
  _n bigint;
BEGIN
  SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum),
         string_agg(CASE WHEN a.attname = 'legacy_id' THEN 'NULL::integer' ELSE '(r).' || quote_ident(a.attname) END,
                    ', ' ORDER BY a.attnum)
    INTO _cols, _vals
    FROM pg_attribute a
   WHERE a.attrelid = 'public.members'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND a.attgenerated = '' AND a.attidentity = '' AND a.attname <> 'id';
  EXECUTE format(
    'UPDATE public.members m SET (%s) = (SELECT %s FROM (SELECT jsonb_populate_record(m, a.before) AS r) s)
       FROM legacy._load_adopted a
      WHERE a.member_id = m.id AND NOT EXISTS (SELECT 1 FROM ul_members t WHERE t.id = m.id)', _cols, _vals);
  GET DIAGNOSTICS _n = ROW_COUNT;
  INSERT INTO ul_counts VALUES ('adopted_restored', _n);
END
$do$;

-- Cônjuge como o plano decidiu (ul_eff), para quem fica.
WITH u AS (
  UPDATE public.members m SET spouse_id = e.spouse_id
    FROM ul_eff e
   WHERE e.id = m.id AND m.spouse_id IS DISTINCT FROM e.spouse_id
  RETURNING 1
)
INSERT INTO ul_counts SELECT 'spouse_updated', count(*) FROM u;

-- Adotado excluído no ensaio (com a conta suspensa pela exclusão): volta não excluído e
-- com o acesso devolvido, como a restauração do E2.01.
WITH s AS (
  SELECT public._del_resume_access(x.member_id)
    FROM private.member_access_suspensions x
    JOIN public.members m ON m.id = x.member_id
   WHERE x.member_id IN (SELECT id FROM ul_adopted) AND m.deleted_at IS NULL
)
INSERT INTO ul_counts SELECT 'adopted_access_resumed', count(*) FROM s;

-- Autoria que aponta para quem saiu: sem autor, tipo "desconhecido" (DT-13, passo 2).
DO $do$
DECLARE
  _t text;
  _f text;
  _n bigint;
  _total bigint := 0;
BEGIN
  FOREACH _t IN ARRAY ARRAY['members', 'cells', 'cell_reports'] LOOP
    FOREACH _f IN ARRAY ARRAY['created', 'updated', 'deleted'] LOOP
      EXECUTE format('UPDATE public.%I x SET %I = NULL, %I = ''unknown''::public.author_kind
                       WHERE x.%I IN (SELECT id FROM ul_members)',
                     _t, _f || '_by', _f || '_by_kind', _f || '_by');
      GET DIAGNOSTICS _n = ROW_COUNT;
      _total := _total + _n;
    END LOOP;
  END LOOP;
  INSERT INTO ul_counts VALUES ('authorship_cleared', _total);
END
$do$;

-- Controle da carga: os adotados já voltaram; as execuções ficam, marcadas como desfeitas.
WITH d AS (DELETE FROM legacy._load_adopted RETURNING 1)
INSERT INTO ul_counts SELECT 'adopted_rows_deleted', count(*) FROM d;

WITH u AS (UPDATE legacy._load_runs SET undone_at = clock_timestamp() WHERE undone_at IS NULL RETURNING 1)
INSERT INTO ul_counts SELECT 'load_runs_undone', count(*) FROM u;

DO $do$
DECLARE
  _n bigint := 0;
BEGIN
  IF to_regclass('legacy._accounts_runs') IS NOT NULL THEN
    ALTER TABLE legacy._accounts_runs ADD COLUMN IF NOT EXISTS undone_at timestamptz;
    UPDATE legacy._accounts_runs SET undone_at = clock_timestamp() WHERE undone_at IS NULL;
    GET DIAGNOSTICS _n = ROW_COUNT;
  END IF;
  INSERT INTO ul_counts VALUES ('accounts_runs_undone', _n);
END
$do$;
