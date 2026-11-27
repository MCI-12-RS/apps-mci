-- =============================================================================
-- E4.06, passo 4: relatórios do legado transformados (pg_temp.lr) e o mapa deles.
-- Mapeamento: 5.5 (Reports → cell_reports); DT-07, DT-08 do spec e4-carga.
-- Nada é gravado aqui.
-- - Ficam de fora (listados): célula inexistente ou de fora, sem data, oferta
--   fora do CHECK (0 a 999.999,99).
-- - Duplicados na semana (célula, week_start(date)) entre os não excluídos:
--   fica o de maior Id (Q-E4-4); os outros migram excluídos pelo sistema.
-- - Retrato: Ids do legado pelo mapa; pessoa inexistente ou de fora e tipo
--   vazio ou inválido vão nulos e o trigger do retrato (ENABLE ALWAYS) completa
--   pela célula no INSERT em replica.
-- - Relatório realizado sem tema migra como está (Q-E4-3).
-- =============================================================================

CREATE TEMP TABLE lr ON COMMIT DROP AS
SELECT r."Id" AS lid,
       coalesce(r."IsDeleted", false) AS del,
       r."CellId" AS cell_lid,
       cm.id AS cell_id,
       EXISTS (SELECT 1 FROM legacy."Cells" c WHERE c."Id" = r."CellId") AS cell_exists,
       r."Date"::date AS date,
       date_trunc('second', r."Date")::time AS time,
       NOT coalesce(r."WeekCellSkipped", false) AS was_held,
       CASE WHEN NOT coalesce(r."WeekCellSkipped", false) THEN pg_temp.blank_null(r."Subject") END AS theme,
       CASE WHEN NOT coalesce(r."WeekCellSkipped", false) THEN pg_temp.blank_null(r."Notes") END AS observations,
       CASE WHEN coalesce(r."WeekCellSkipped", false) THEN pg_temp.blank_null(r."Notes") END AS reason_not_held,
       ARRAY(SELECT btrim(v.s)
               FROM regexp_split_to_table(coalesce(r."Visitors", ''), '\|') WITH ORDINALITY v(s, o)
              WHERE btrim(v.s) <> '' ORDER BY v.o) AS visitors,
       round(r."Contribution", 2) AS offering,
       ml.id AS snapshot_leader_id,
       mt.id AS snapshot_timothy_id,
       mh.id AS snapshot_host_id,
       CASE r."CellType" WHEN 0 THEN 'Evangelística' WHEN 1 THEN 'Discipulado' WHEN 2 THEN 'Macrocélula' END
         AS snapshot_cell_type,
       r."CreatedBy" AS created_by_raw,
       r."CreationDate" AS created_on,
       r."LastModifiedBy" AS updated_by_raw,
       r."LastModifiedDate" AS updated_on
  FROM legacy."Reports" r
  LEFT JOIN cell_map cm ON cm.lid = r."CellId"
  LEFT JOIN member_map ml ON ml.lid = r."LeadershipId"
  LEFT JOIN member_map mt ON mt.lid = r."TimothyId"
  LEFT JOIN member_map mh ON mh.lid = r."HostId";

ALTER TABLE lr ADD PRIMARY KEY (lid);
ALTER TABLE lr ADD COLUMN included boolean NOT NULL DEFAULT false, ADD COLUMN dup_of integer;

CREATE TEMP TABLE lr_out ON COMMIT DROP AS
SELECT x.code, x.lid, x.info
  FROM (
    SELECT CASE WHEN cell_exists THEN 'report_cell_left_out' ELSE 'report_cell_missing' END AS code, lid,
           concat_ws('; ', 'célula: ' || cell_lid, CASE WHEN del THEN 'excluído' END) AS info
      FROM lr WHERE cell_id IS NULL
    UNION ALL
    SELECT 'report_date_missing', lid, CASE WHEN del THEN 'excluído' END FROM lr WHERE date IS NULL
    UNION ALL
    SELECT 'report_offering_out_of_range', lid, CASE WHEN del THEN 'excluído' END FROM lr
     WHERE offering < 0 OR offering > 999999.99
  ) x;

INSERT INTO load_issues SELECT code, lid, info FROM lr_out;

UPDATE lr SET included = true WHERE NOT EXISTS (SELECT 1 FROM lr_out o WHERE o.lid = lr.lid);

-- Duplicados na semana: fica o de maior Id (índice cell_reports_cell_week_key).
UPDATE lr SET dup_of = d.keeper
  FROM (
    SELECT lid, max(lid) OVER (PARTITION BY cell_lid, public.week_start(date)) AS keeper,
           count(*) OVER (PARTITION BY cell_lid, public.week_start(date)) AS n
      FROM lr WHERE included AND NOT del
  ) d
 WHERE d.lid = lr.lid AND d.n > 1 AND d.lid <> d.keeper;

INSERT INTO load_issues
SELECT 'report_duplicate_week', g.lid,
       CASE WHEN g.lid = g.keeper THEN 'fica (maior Id); grupo: ' ELSE 'vai como excluído; grupo: ' END || g.grp
  FROM (
    SELECT l.lid, max(l.lid) OVER w AS keeper,
           string_agg(l.lid::text, ', ') OVER (w ORDER BY l.lid ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS grp,
           count(*) OVER w AS n
      FROM lr l WHERE l.included AND NOT l.del
    WINDOW w AS (PARTITION BY l.cell_lid, public.week_start(l.date))
  ) g
 WHERE g.n > 1;

INSERT INTO load_issues
SELECT 'report_snapshot_from_cell', lid,
       concat_ws(', ', CASE WHEN snapshot_leader_id IS NULL THEN 'líder' END,
                       CASE WHEN snapshot_timothy_id IS NULL THEN 'timóteo' END,
                       CASE WHEN snapshot_host_id IS NULL THEN 'anfitrião' END,
                       CASE WHEN snapshot_cell_type IS NULL THEN 'tipo' END)
  FROM lr
 WHERE included
   AND (snapshot_leader_id IS NULL OR snapshot_timothy_id IS NULL OR snapshot_host_id IS NULL OR snapshot_cell_type IS NULL)
UNION ALL
SELECT 'report_held_without_theme', lid, CASE WHEN del THEN 'excluído' END FROM lr
 WHERE included AND was_held AND theme IS NULL;

CREATE TEMP TABLE report_map (
  lid integer PRIMARY KEY,
  id uuid NOT NULL UNIQUE,
  how text NOT NULL CHECK (how IN ('existing', 'new'))
) ON COMMIT DROP;

INSERT INTO report_map (lid, id, how)
SELECT l.lid, coalesce(r.id, gen_random_uuid()), CASE WHEN r.id IS NULL THEN 'new' ELSE 'existing' END
  FROM lr l LEFT JOIN public.cell_reports r ON r.legacy_id = l.lid
 WHERE l.included;

-- Outro relatório não excluído da mesma célula e semana, fora desta carga
-- (lançado no novo, ou carregado antes e ausente agora): o índice único barraria.
INSERT INTO load_issues
SELECT 'report_week_conflict_new', l.lid, NULL
  FROM lr l JOIN report_map rm ON rm.lid = l.lid
 WHERE l.included AND NOT l.del AND l.dup_of IS NULL
   AND EXISTS (SELECT 1 FROM public.cell_reports x
                WHERE x.cell_id = l.cell_id AND public.week_start(x.date) = public.week_start(l.date)
                  AND x.deleted_at IS NULL
                  AND NOT EXISTS (SELECT 1 FROM report_map y WHERE y.id = x.id));

INSERT INTO load_issues
SELECT 'report_stale', r.legacy_id, CASE WHEN l.lid IS NULL THEN 'não existe no legado' ELSE 'ficou de fora' END
  FROM public.cell_reports r LEFT JOIN lr l ON l.lid = r.legacy_id
 WHERE r.legacy_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM report_map rm WHERE rm.lid = r.legacy_id);

-- Participantes (5.5): o que não resolve é listado, não descartado em silêncio.
CREATE TEMP TABLE lp ON COMMIT DROP AS
SELECT rm."ReportId" AS report_lid, rm."MemberId" AS member_lid, r.id AS report_id, m.id AS member_id
  FROM legacy."ReportMembers" rm
  LEFT JOIN report_map r ON r.lid = rm."ReportId"
  LEFT JOIN member_map m ON m.lid = rm."MemberId";

INSERT INTO load_issues
SELECT 'participant_left_out', report_lid,
       concat_ws('; ', 'membro: ' || member_lid,
                 CASE WHEN report_id IS NULL THEN 'relatório não existe ou ficou de fora' END,
                 CASE WHEN member_id IS NULL THEN 'membro não existe ou ficou de fora' END)
  FROM lp WHERE report_id IS NULL OR member_id IS NULL;
