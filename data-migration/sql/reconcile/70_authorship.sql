-- =============================================================================
-- E4.09: autoria do legado (RN-10 e RN-11 do E2.05; DT-15 do E4).
-- Recalcula private.legacy_authorship(...) com os valores do legado e compara com o gravado em
-- membros, células e relatórios carregados. O detalhe cita só os campos.
--   authorship_member, authorship_cell, authorship_report
--   authorship_kinds (metric)  quantos por tipo de autor (legacy, unknown, system), por tabela
-- A data de exclusão sem data no legado (a hora da carga) e a exclusão dos duplicados da semana
-- (pelo sistema, DT-08) não são comparadas aqui (report_status confere os duplicados).
-- Nenhum carregado tem autor do novo (created_by, updated_by, deleted_by nulos).
-- =============================================================================
WITH /*BASE*/,
src AS (
  SELECT 'authorship_member' AS code, 'Membros' AS entity, x."Id" AS lid, x."CreatedBy" AS cb, x."CreationDate" AS con,
         x."LastModifiedBy" AS ub, x."LastModifiedDate" AS uon, coalesce(x."IsDeleted", false) AS del,
         n.created_at, n.created_by, n.created_by_kind::text AS created_by_kind, n.created_by_legacy,
         n.updated_at, n.updated_by, n.updated_by_kind::text AS updated_by_kind, n.updated_by_legacy,
         n.deleted_at, n.deleted_by, n.deleted_by_kind::text AS deleted_by_kind, n.deleted_by_legacy
    FROM legacy."Members" x JOIN public.members n ON n.legacy_id = x."Id"
  UNION ALL
  SELECT 'authorship_cell', 'Células', x."Id", x."CreatedBy", x."CreationDate", x."LastModifiedBy", x."LastModifiedDate",
         coalesce(x."IsDeleted", false),
         n.created_at, n.created_by, n.created_by_kind::text, n.created_by_legacy,
         n.updated_at, n.updated_by, n.updated_by_kind::text, n.updated_by_legacy,
         n.deleted_at, n.deleted_by, n.deleted_by_kind::text, n.deleted_by_legacy
    FROM legacy."Cells" x JOIN public.cells n ON n.legacy_id = x."Id"
  UNION ALL
  SELECT 'authorship_report', 'Relatórios', x."Id", x."CreatedBy", x."CreationDate", x."LastModifiedBy", x."LastModifiedDate",
         coalesce(x."IsDeleted", false),
         n.created_at, n.created_by, n.created_by_kind::text, n.created_by_legacy,
         n.updated_at, n.updated_by, n.updated_by_kind::text, n.updated_by_legacy,
         n.deleted_at, n.deleted_by, n.deleted_by_kind::text, n.deleted_by_legacy
    FROM legacy."Reports" x JOIN public.cell_reports n ON n.legacy_id = x."Id"
),
cmp AS (
  SELECT s.code, s.entity, s.lid,
         array_remove(ARRAY[
           CASE WHEN s.created_at IS DISTINCT FROM a.created_at THEN 'created_at' END,
           CASE WHEN s.created_by_kind IS DISTINCT FROM a.created_by_kind::text THEN 'created_by_kind' END,
           CASE WHEN s.created_by_legacy IS DISTINCT FROM a.created_by_legacy THEN 'created_by_legacy' END,
           CASE WHEN s.updated_at IS DISTINCT FROM a.updated_at THEN 'updated_at' END,
           CASE WHEN s.updated_by_kind IS DISTINCT FROM a.updated_by_kind::text THEN 'updated_by_kind' END,
           CASE WHEN s.updated_by_legacy IS DISTINCT FROM a.updated_by_legacy THEN 'updated_by_legacy' END,
           CASE WHEN s.del AND s.deleted_at IS NOT NULL AND s.deleted_by_kind IS DISTINCT FROM a.deleted_by_kind::text THEN 'deleted_by_kind' END,
           CASE WHEN s.del AND s.deleted_at IS NOT NULL AND s.deleted_by_legacy IS DISTINCT FROM a.deleted_by_legacy THEN 'deleted_by_legacy' END,
           CASE WHEN s.del AND a.deleted_at IS NOT NULL AND s.deleted_at IS DISTINCT FROM a.deleted_at THEN 'deleted_at' END,
           CASE WHEN s.created_by IS NOT NULL OR s.updated_by IS NOT NULL OR s.deleted_by IS NOT NULL THEN 'autor do novo' END
         ], NULL) AS fields
    FROM src s
   CROSS JOIN LATERAL private.legacy_authorship(s.cb, s.con, s.ub, s.uon, s.del, NULL::timestamptz) a
)
SELECT 'diff'::text AS kind, c.code, c.lid::bigint AS lid, NULL::text AS ref,
       'campos: ' || array_to_string(c.fields, ', ') AS detail, NULL::text AS expected, NULL::jsonb AS data
  FROM cmp c
 WHERE cardinality(c.fields) > 0
UNION ALL
SELECT 'compared', c.code, NULL, NULL, NULL, NULL, jsonb_build_object('n', count(*))
  FROM cmp c GROUP BY c.code
UNION ALL
SELECT 'metric', 'authorship_kinds', NULL, s.entity, NULL, NULL,
       jsonb_build_object('entity', s.entity,
         'created', jsonb_build_object('legacy', count(*) FILTER (WHERE s.created_by_kind = 'legacy'),
                                       'unknown', count(*) FILTER (WHERE s.created_by_kind = 'unknown'),
                                       'other', count(*) FILTER (WHERE s.created_by_kind NOT IN ('legacy', 'unknown'))),
         'updated', jsonb_build_object('legacy', count(*) FILTER (WHERE s.updated_by_kind = 'legacy'),
                                       'unknown', count(*) FILTER (WHERE s.updated_by_kind = 'unknown'),
                                       'none', count(*) FILTER (WHERE s.updated_by_kind IS NULL),
                                       'other', count(*) FILTER (WHERE s.updated_by_kind NOT IN ('legacy', 'unknown'))),
         'deleted', jsonb_build_object('legacy', count(*) FILTER (WHERE s.deleted_by_kind = 'legacy'),
                                       'unknown', count(*) FILTER (WHERE s.deleted_by_kind = 'unknown'),
                                       'system', count(*) FILTER (WHERE s.deleted_by_kind = 'system'),
                                       'other', count(*) FILTER (WHERE s.deleted_by_kind NOT IN ('legacy', 'unknown', 'system'))),
         'ok', NULL)
  FROM src s GROUP BY s.entity
ORDER BY 1, 2, 3, 4, 5;
