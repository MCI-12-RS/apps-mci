-- =============================================================================
-- E4.09: amostra de credenciais legadas (6.3; RN-01 do E3), um LOTE por comando.
--   credential_hash_mismatch  o bcrypt guardado em private.legacy_credentials confere com o MD5 do
--                             legado (lido só aqui dentro; nunca é parâmetro nem sai daqui)
--
-- Não está em STEP_FILES: o src/reconcile.mjs sorteia os Ids antes (só Ids do legado, sem dado
-- sensível), põe cada lote em mci.rc_cred_ids e roda este arquivo uma vez por lote, com até
-- CREDENTIAL_BATCH bcrypts (~60 ms cada). Nenhum comando que lê o MD5 chega perto dos 10 s do
-- auto_explain de produção (risco 11 do E1.04). Devolve só as diferenças do lote e quantos
-- conferiu; o script soma.
-- =============================================================================
WITH /*BASE*/,
ids AS (SELECT unnest(current_setting('mci.rc_cred_ids')::int[]) AS lid),
batch AS (
  SELECT m.legacy_id AS lid, c.legacy_hash, l."Password" AS pw
    FROM ids
    JOIN public.members m ON m.legacy_id = ids.lid
    JOIN private.legacy_credentials c ON c.member_id = m.id AND c.legacy_hash IS NOT NULL
    JOIN legacy."Members" l ON l."Id" = m.legacy_id
),
checked AS (
  SELECT b.lid,
         extensions.crypt(lower(regexp_replace(b.pw, '^[[:space:] ]+|[[:space:] ]+$', '', 'g')), b.legacy_hash)
           = b.legacy_hash AS ok
    FROM batch b
)
SELECT 'diff'::text AS kind, 'credential_hash_mismatch'::text AS code, k.lid::bigint AS lid, NULL::text AS ref,
       'o bcrypt não confere com o MD5 do legado'::text AS detail, NULL::text AS expected, NULL::jsonb AS data
  FROM checked k WHERE NOT k.ok
UNION ALL
SELECT 'compared', 'credential_hash_mismatch', NULL, NULL, NULL, NULL, jsonb_build_object('n', (SELECT count(*) FROM checked))
ORDER BY 1, 2, 3;
