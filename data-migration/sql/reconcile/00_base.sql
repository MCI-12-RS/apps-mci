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
-- conferida), mci.rc_seed (sorteio das amostras), mci.rc_cred_sample.
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
         current_setting('mci.rc_seed') AS seed,
         current_setting('mci.rc_cred_sample')::int AS cred_sample
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
)
