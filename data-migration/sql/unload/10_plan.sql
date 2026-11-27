-- =============================================================================
-- Limpeza do ensaio (DT-13 do spec e4-carga, Q-E4-2), passo 1: plano, sem gravar
-- nada fora de pg_temp. Roda na transação da limpeza, com as quatro tabelas travadas.
--
-- Conjuntos (o que sai):
--   carga   membros, células e relatórios com legacy_id preenchido e não adotados;
--   ensaio  sem legacy_id, criados (created_at) depois do início da primeira carga ativa
--           (t0, legacy._load_runs), que apontam para a carga, direto ou por cadeia:
--             membro   pelo líder (o cônjuge não é dependência: o vínculo é desfeito);
--             célula   pelo líder, timóteo ou anfitrião;
--             relatório pela célula ou por uma pessoa do retrato.
-- Os adotados (legacy._load_adopted) voltam à linha de antes (before), com legacy_id nulo:
-- o plano já usa esses valores (ul_eff), inclusive para decidir quem é do ensaio (um adotado
-- numa carga posterior pode ter sido criado no ensaio debaixo de alguém da carga).
-- Participantes saem quando o relatório ou o membro sai, inclusive de um relatório que fica
-- (a presença foi registrada no ensaio). O vínculo de cônjuge com quem sai é desfeito.
--
-- Bloqueios (ul_issues, categoria block do catálogo src/lib/unload-codes.mjs): cadastro que
-- fica (anterior à carga, ou criado no ensaio sem depender dela) e aponta para quem sai;
-- adotado que não existe mais; identificador do adotado em uso por outro cadastro;
-- cônjuge que não dá para refazer.
-- Ocorrências só com o Id do legado (legacy_id) ou o id do registro do novo (ref): nada de
-- nome, e-mail, CPF ou telefone.
-- =============================================================================

CREATE TEMP TABLE ul_issues (code text NOT NULL, legacy_id integer, ref text, info text) ON COMMIT DROP;

-- t0: início da primeira carga ativa (gravada e não desfeita); sem nenhuma ativa, a primeira registrada.
CREATE TEMP TABLE ul_cfg ON COMMIT DROP AS
SELECT coalesce((SELECT min(started_at) FROM legacy._load_runs WHERE undone_at IS NULL AND finished_at IS NOT NULL),
                (SELECT min(started_at) FROM legacy._load_runs)) AS t0;

-- Adotados: a linha de antes da adoção.
CREATE TEMP TABLE ul_adopted ON COMMIT DROP AS
SELECT a.member_id AS id, a.legacy_id, m.id IS NOT NULL AS exists_
  FROM legacy._load_adopted a
  LEFT JOIN public.members m ON m.id = a.member_id;

INSERT INTO ul_issues
SELECT 'adopted_member_missing', legacy_id, id::text, NULL FROM ul_adopted WHERE NOT exists_;

-- Membros como ficarão: o adotado com os valores de antes (e legacy_id nulo), os outros como estão.
CREATE TEMP TABLE ul_eff ON COMMIT DROP AS
SELECT r.id,
       CASE WHEN a.member_id IS NULL THEN r.legacy_id END AS legacy_id,
       a.member_id IS NOT NULL AS adopted,
       r.leader_id, r.spouse_id, r.created_at, r.deleted_at, r.auth_user_id,
       public.normalize_email(r.email) AS email_key,
       public.mobile_match_key(r.mobile_whatsapp) AS mobile_key,
       public.normalize_digits(r.cpf) AS cpf_key
  FROM public.members m
  LEFT JOIN legacy._load_adopted a ON a.member_id = m.id
 CROSS JOIN LATERAL (
   SELECT (CASE WHEN a.member_id IS NULL THEN m ELSE jsonb_populate_record(m, a.before) END).*
 ) r;
CREATE UNIQUE INDEX ON ul_eff (id);
CREATE INDEX ON ul_eff (leader_id);
CREATE INDEX ON ul_eff (spouse_id);
CREATE INDEX ON ul_eff (auth_user_id);
ANALYZE ul_eff;

-- Membros que saem: a carga e, por cadeia de liderança, os criados no ensaio debaixo dela.
CREATE TEMP TABLE ul_members (id uuid PRIMARY KEY, legacy_id integer, kind text NOT NULL) ON COMMIT DROP;
INSERT INTO ul_members (id, legacy_id, kind)
WITH RECURSIVE r (id, legacy_id, kind) AS (
  SELECT e.id, e.legacy_id, 'load' FROM ul_eff e WHERE e.legacy_id IS NOT NULL
  UNION
  SELECT e.id, NULL::integer, 'rehearsal'
    FROM ul_eff e JOIN r ON e.leader_id = r.id
   CROSS JOIN ul_cfg cfg
   WHERE e.legacy_id IS NULL AND coalesce(e.created_at >= cfg.t0, false)
)
SELECT DISTINCT ON (id) id, legacy_id, kind FROM r ORDER BY id, kind;
ANALYZE ul_members;

CREATE TEMP TABLE ul_cells (id uuid PRIMARY KEY, legacy_id integer, kind text NOT NULL) ON COMMIT DROP;
INSERT INTO ul_cells (id, legacy_id, kind)
SELECT c.id, c.legacy_id, CASE WHEN c.legacy_id IS NOT NULL THEN 'load' ELSE 'rehearsal' END
  FROM public.cells c CROSS JOIN ul_cfg cfg
 WHERE c.legacy_id IS NOT NULL
    OR (coalesce(c.created_at >= cfg.t0, false)
        AND EXISTS (SELECT 1 FROM ul_members t WHERE t.id IN (c.leader_id, c.timothy_id, c.host_id)));
ANALYZE ul_cells;

CREATE TEMP TABLE ul_reports (id uuid PRIMARY KEY, legacy_id integer, kind text NOT NULL) ON COMMIT DROP;
INSERT INTO ul_reports (id, legacy_id, kind)
SELECT x.id, x.legacy_id, CASE WHEN x.legacy_id IS NOT NULL THEN 'load' ELSE 'rehearsal' END
  FROM public.cell_reports x CROSS JOIN ul_cfg cfg
 WHERE x.legacy_id IS NOT NULL
    OR (coalesce(x.created_at >= cfg.t0, false)
        AND (EXISTS (SELECT 1 FROM ul_cells c WHERE c.id = x.cell_id)
             OR EXISTS (SELECT 1 FROM ul_members t
                         WHERE t.id IN (x.snapshot_leader_id, x.snapshot_timothy_id, x.snapshot_host_id))));
ANALYZE ul_reports;

-- Quem fica e aponta para quem sai (fora participantes e cônjuge): para a limpeza.
INSERT INTO ul_issues
SELECT 'member_points_to_removed', NULL::integer, e.id::text,
       'líder: ' || coalesce('Id do legado ' || t.legacy_id, 'cadastro do ensaio ' || t.id)
  FROM ul_eff e JOIN ul_members t ON t.id = e.leader_id
 WHERE NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id = e.id);

INSERT INTO ul_issues
SELECT 'cell_points_to_removed', NULL::integer, c.id::text,
       string_agg(p.role || ': ' || coalesce('Id do legado ' || t.legacy_id, 'cadastro do ensaio ' || t.id), '; '
                  ORDER BY p.ord)
  FROM public.cells c
 CROSS JOIN LATERAL (VALUES (1, 'líder', c.leader_id), (2, 'timóteo', c.timothy_id), (3, 'anfitrião', c.host_id)) p(ord, role, member_id)
  JOIN ul_members t ON t.id = p.member_id
 WHERE NOT EXISTS (SELECT 1 FROM ul_cells x WHERE x.id = c.id)
 GROUP BY c.id;

INSERT INTO ul_issues
SELECT 'report_points_to_removed', NULL::integer, x.id::text,
       concat_ws('; ',
         CASE WHEN EXISTS (SELECT 1 FROM ul_cells c WHERE c.id = x.cell_id) THEN 'célula' END,
         CASE WHEN EXISTS (SELECT 1 FROM ul_members t
                            WHERE t.id IN (x.snapshot_leader_id, x.snapshot_timothy_id, x.snapshot_host_id))
              THEN 'pessoa do retrato' END)
  FROM public.cell_reports x
 WHERE NOT EXISTS (SELECT 1 FROM ul_reports r WHERE r.id = x.id)
   AND (EXISTS (SELECT 1 FROM ul_cells c WHERE c.id = x.cell_id)
        OR EXISTS (SELECT 1 FROM ul_members t
                    WHERE t.id IN (x.snapshot_leader_id, x.snapshot_timothy_id, x.snapshot_host_id)));

-- Identificador do adotado (o de antes) em uso por outro cadastro que fica, não excluído:
-- o índice único barraria a volta (alguém cadastrou no ensaio o e-mail, o celular ou o CPF de antes).
INSERT INTO ul_issues
SELECT DISTINCT 'adopted_identifier_taken', a.legacy_id, a.id::text, 'campo: ' || k.field
  FROM ul_eff e
  JOIN ul_adopted a ON a.id = e.id
 CROSS JOIN LATERAL (VALUES ('e-mail', e.email_key), ('celular', e.mobile_key), ('CPF', e.cpf_key)) k(field, val)
  JOIN ul_eff o ON o.id <> e.id AND o.deleted_at IS NULL
               AND ((k.field = 'e-mail' AND o.email_key = k.val) OR (k.field = 'celular' AND o.mobile_key = k.val)
                    OR (k.field = 'CPF' AND o.cpf_key = k.val))
 WHERE e.deleted_at IS NULL AND k.val IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id = o.id)
   AND NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id = e.id);

-- Cônjuge -------------------------------------------------------------------------------
CREATE TEMP TABLE ul_spouse_touched (id uuid PRIMARY KEY) ON COMMIT DROP;

-- (1) Quem fica e tem como cônjuge alguém que sai: o vínculo é desfeito.
WITH u AS (
  UPDATE ul_eff e SET spouse_id = NULL
   WHERE e.spouse_id IN (SELECT id FROM ul_members)
     AND NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id = e.id)
  RETURNING e.id
), i AS (
  INSERT INTO ul_spouse_touched SELECT id FROM u ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO ul_issues SELECT 'spouse_unlinked', NULL::integer, id::text, 'o cônjuge sai na limpeza' FROM u;

-- (2) O adotado volta com o cônjuge de antes; a carga tinha desfeito o lado do outro
--     (cadastro do novo sem par no legado): refeito, se o outro está sem cônjuge.
WITH u AS (
  UPDATE ul_eff s SET spouse_id = a.id
    FROM ul_eff a
   WHERE a.adopted AND a.spouse_id = s.id AND s.id <> a.id AND s.spouse_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id IN (a.id, s.id))
  RETURNING s.id
), i AS (
  INSERT INTO ul_spouse_touched SELECT id FROM u ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO ul_issues SELECT 'spouse_restored', NULL::integer, id::text, 'cônjuge de antes de um adotado' FROM u;

-- (3) Quem fica (não adotado) e casou no ensaio com um adotado que volta com outro cônjuge
--     (ou sem cônjuge): o vínculo é desfeito.
WITH u AS (
  UPDATE ul_eff s SET spouse_id = NULL
    FROM ul_eff a
   WHERE NOT s.adopted AND s.spouse_id = a.id AND a.adopted AND a.spouse_id IS DISTINCT FROM s.id
     AND NOT EXISTS (SELECT 1 FROM ul_members x WHERE x.id IN (a.id, s.id))
  RETURNING s.id
), i AS (
  INSERT INTO ul_spouse_touched SELECT id FROM u ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO ul_issues SELECT 'spouse_unlinked', NULL::integer, id::text, 'casou no ensaio com um adotado que volta' FROM u;

-- (4) Vínculo que não fecha nos dois lados, envolvendo um adotado ou um cadastro mexido acima
--     (o outro lado casou no ensaio com outra pessoa): para a limpeza.
INSERT INTO ul_issues
SELECT 'spouse_conflict', a.legacy_id, x.id::text, 'cônjuge: ' || y.id
  FROM ul_eff x
  JOIN ul_eff y ON y.id = x.spouse_id
  LEFT JOIN ul_adopted a ON a.id = x.id
 WHERE (x.adopted OR y.adopted OR x.id IN (SELECT id FROM ul_spouse_touched) OR y.id IN (SELECT id FROM ul_spouse_touched))
   AND y.spouse_id IS DISTINCT FROM x.id
   AND NOT EXISTS (SELECT 1 FROM ul_members t WHERE t.id IN (x.id, y.id));

-- Participantes que saem de relatórios que ficam (a presença de quem sai).
CREATE TEMP TABLE ul_participants_kept_report ON COMMIT DROP AS
SELECT p.report_id, p.member_id
  FROM public.cell_report_participants p
 WHERE p.member_id IN (SELECT id FROM ul_members)
   AND NOT EXISTS (SELECT 1 FROM ul_reports r WHERE r.id = p.report_id);
INSERT INTO ul_issues
SELECT 'participant_removed_from_kept_report', NULL::integer, report_id::text, count(*) || ' participante(s)'
  FROM ul_participants_kept_report GROUP BY report_id;

-- Contas do Auth a apagar (pela Admin API, depois do commit): as de quem sai, a criada
-- pelo npm run accounts para o adotado que não tinha conta, e as que levam o Id do legado
-- no app_metadata, desde que nenhum cadastro que fica aponte para elas.
CREATE TEMP TABLE ul_accounts (id uuid PRIMARY KEY, why text NOT NULL) ON COMMIT DROP;
INSERT INTO ul_accounts (id, why)
SELECT DISTINCT ON (x.id) x.id, x.why
  FROM (
    SELECT m.auth_user_id AS id,
           CASE WHEN t.id IS NOT NULL THEN 'removed_member' ELSE 'adopted_restored' END AS why, 1 AS ord
      FROM public.members m LEFT JOIN ul_members t ON t.id = m.id
     WHERE m.auth_user_id IS NOT NULL
    UNION ALL
    SELECT e.auth_user_id, 'removed_member', 1
      FROM ul_eff e JOIN ul_members t ON t.id = e.id WHERE e.auth_user_id IS NOT NULL
    UNION ALL
    SELECT u.id, 'legacy_marker', 2 FROM auth.users u WHERE u.raw_app_meta_data ? 'legacy_member_id'
  ) x
 WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.id)
   AND NOT EXISTS (SELECT 1 FROM ul_eff s WHERE s.auth_user_id = x.id
                    AND NOT EXISTS (SELECT 1 FROM ul_members t WHERE t.id = s.id))
 ORDER BY x.id, x.ord;

INSERT INTO ul_issues
SELECT 'adopted_restored', a.legacy_id, a.id::text,
       CASE WHEN EXISTS (SELECT 1 FROM ul_members t WHERE t.id = a.id) THEN 'criado no ensaio debaixo da carga: sai'
            WHEN EXISTS (SELECT 1 FROM ul_accounts c JOIN public.members m ON m.auth_user_id = c.id WHERE m.id = a.id)
              THEN 'não tinha conta: a conta criada pela carga sai'
            ELSE NULL END
  FROM ul_adopted a WHERE a.exists_;

INSERT INTO ul_issues
SELECT 'rehearsal_member_removed', NULL::integer, id::text, NULL FROM ul_members WHERE kind = 'rehearsal'
UNION ALL
SELECT 'rehearsal_cell_removed', NULL::integer, id::text, NULL FROM ul_cells WHERE kind = 'rehearsal'
UNION ALL
SELECT 'rehearsal_report_removed', NULL::integer, id::text, NULL FROM ul_reports WHERE kind = 'rehearsal';
