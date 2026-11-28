-- =============================================================================
-- E4.09 (DT-15 do spec e4-carga): CTEs comuns da reconciliação.
--
-- Não é um comando: o src/reconcile.mjs põe este texto no lugar de /*BASE*/ no
-- WITH de cada arquivo (só os CTEs citados são calculados). Tudo roda numa
-- transação REPEATABLE READ READ ONLY, como postgres: nada é gravado (nem
-- tabela temporária, que o READ ONLY recusa).
--
-- Parâmetros (set_config, só Ids do legado, números e o instante): mci.rc_pastor_ids,
-- mci.rc_admin_ids, mci.rc_at (instante de referência), mci.rc_load_run (a carga
-- conferida), mci.rc_seed (sorteio das amostras). O lote da amostra de credenciais vai em
-- mci.rc_cred_ids, só no 82_credential_sample.sql.
--
-- Todo arquivo devolve as mesmas colunas:
--   kind      diff (diferença), compared (quantos foram comparados), metric (números),
--             item (lista sem comparação: listas do banco, atenção, amostras)
--   check     código do catálogo src/lib/reconcile-codes.mjs
--   lid       Id do legado (quando há)
--   ref       outra chave sem dado pessoal (id do novo, mês, membro do par)
--   detail    o que difere: nomes de campo e números, nunca o valor
--   expected  diferença esperada: códigos candidatos separados por vírgula (o
--             script aceita o primeiro que vale; os da carga precisam estar
--             listados na carga conferida)
--   data      números (metric, compared)
-- =============================================================================
cfg AS (
  SELECT coalesce(nullif(current_setting('mci.rc_pastor_ids', true), ''), '{}')::int[] AS pastor_ids,
         coalesce(nullif(current_setting('mci.rc_admin_ids', true), ''), '{}')::int[] AS admin_ids,
         current_setting('mci.rc_at')::timestamptz AS at,
         current_setting('mci.rc_load_run')::bigint AS load_run,
         current_setting('mci.rc_seed') AS seed
),
-- id do novo → Id do legado (nulo para quem é só do novo).
idmap AS (SELECT m.id, m.legacy_id AS lid FROM public.members m),
-- Ocorrências listadas pela carga conferida (código, Id do legado).
doc AS (
  SELECT e.key AS code, v.value::int AS lid
    FROM cfg
    JOIN legacy._load_runs r ON r.id = cfg.load_run
   CROSS JOIN LATERAL jsonb_each(r.lists) e
   CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(e.value) = 'array' THEN e.value ELSE '[]' END) v
   WHERE v.value ~ '^[0-9]{1,10}$'
),
-- Membros do legado: só o que mais de um arquivo usa.
lmb AS (
  SELECT x."Id" AS lid, coalesce(x."IsDeleted", false) AS del, NOT coalesce(x."Idle", false) AS active,
         x."LeadershipId" AS leader_raw, x."SpouseId" AS spouse_raw,
         coalesce(x."HasNoLeadership", false) AS no_leadership,
         CASE x."Gender" WHEN 0 THEN 'M' WHEN 1 THEN 'F' END AS gender,
         x."MinistryLevel" AS ministry_level
    FROM legacy."Members" x
),
-- Relatórios do legado com o duplicado da semana (DT-08, Q-E4-4), pela regra da carga e sem
-- olhar o que o novo fez com ele: não excluído, com data, carregado, e com outro não excluído e
-- carregado da mesma célula e semana com Id maior (fica o de maior Id). dup = o duplicado real
-- que a carga também listou em report_duplicate_week (a carga lista o que fica e os que saem;
-- só os que saem são duplicados). Semana calculada uma vez por relatório (janela, não par a par).
lrep AS (
  SELECT w.*, w.dup_real AND w.dup_listed AS dup
    FROM (
      SELECT r.*,
             coalesce(r.loaded AND NOT r.del AND r.week IS NOT NULL
                      AND r.lid < max(r.lid) FILTER (WHERE r.loaded AND NOT r.del AND r.week IS NOT NULL)
                                    OVER (PARTITION BY r.cell_lid, r.week), false) AS dup_real
        FROM (
          SELECT x."Id" AS lid, coalesce(x."IsDeleted", false) AS del, x."CellId" AS cell_lid,
                 public.week_start(x."Date"::date) AS week,
                 coalesce(to_char(x."Date", 'YYYY-MM'), 'sem data') AS month,
                 round(x."Contribution", 2) AS offering,
                 n.id IS NOT NULL AS loaded, n.deleted_at IS NOT NULL AS n_del, n.deleted_by_kind::text AS n_del_kind,
                 x."Id" IN (SELECT d.lid FROM doc d WHERE d.code = 'report_duplicate_week') AS dup_listed
            FROM legacy."Reports" x
            LEFT JOIN public.cell_reports n ON n.legacy_id = x."Id"
        ) r
    ) w
)
