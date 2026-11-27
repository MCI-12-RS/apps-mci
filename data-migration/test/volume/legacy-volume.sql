-- Volume FICTÍCIO para medir a carga (test/run-local.sh, LOAD_VOLUME=1): substitui o
-- conteúdo do schema legacy da stack local por 3 mil membros (árvore de 4 em 4, cerca
-- de 6 níveis), 300 células, 30 mil relatórios (100 semanas por célula) e cerca de
-- 150 mil participantes. Nenhum dado real. Pastores: Ids 1 e 2.
BEGIN;
TRUNCATE legacy."ReportMembers", legacy."Reports", legacy."Cells", legacy."Members", legacy."Addresses";

INSERT INTO legacy."Addresses" ("Id", "Street", "Number", "Neighborhood", "City", "State", "PostalCode", "IsDeleted")
SELECT i, 'Rua Volume ' || i, (i % 900)::text, 'Bairro ' || (i % 40), 'Cidade Ficticia', 'RS',
       lpad((90000000 + i)::text, 8, '0'), false
  FROM generate_series(1, 3300) i;

INSERT INTO legacy."Members" ("Id", "Name", "Gender", "Email", "MobileNumber", "BirthDate", "LeadershipId", "SpouseId",
  "HasNoLeadership", "Idle", "Baptized", "BaptismDate", "HomeAddressId", "Password", "Role", "ChildrenMembersComputed",
  "CreatedBy", "CreationDate", "LastModifiedBy", "LastModifiedDate", "IsDeleted")
SELECT i, 'Pessoa Volume' || i, (i + 1) % 2, 'v' || i || '@exemplo.org', '519' || lpad(i::text, 8, '0'),
       timestamp '1980-01-01' + (i % 9000) * interval '1 day',
       CASE WHEN i <= 2 THEN NULL ELSE (i + 1) / 4 END,
       CASE WHEN i = 1 THEN 2 WHEN i = 2 THEN 1
            WHEN i > 2 AND i % 10 = 3 THEN i + 1 WHEN i > 2 AND i % 10 = 4 THEN i - 1 END,
       false, i % 20 = 7, i % 3 <> 0, CASE WHEN i % 3 <> 0 THEN timestamp '2015-06-01' END, i,
       md5('volume' || i), 'AppUser', false,
       'Operador Volume', timestamp '2022-01-01' + (i % 700) * interval '1 day',
       CASE WHEN i % 5 = 0 THEN 'Operador Volume' END,
       CASE WHEN i % 5 = 0 THEN timestamp '2024-03-01' + (i % 200) * interval '1 day' END,
       i > 2250 AND i % 50 = 0
  FROM generate_series(1, 3000) i;

INSERT INTO legacy."Cells" ("Id", "LeadId", "TimothyId", "HostId", "WeekDay", "Time", "PlaceId", "CellType",
  "ReportMandatory", "CreatedBy", "CreationDate", "IsDeleted")
SELECT c, 100 + c, 400 + c, 700 + c, c % 7, CASE WHEN c % 2 = 0 THEN '19:30' ELSE '20:00' END, 3000 + c, c % 3,
       false, 'Operador Volume', timestamp '2023-01-01' + c * interval '1 day', c % 30 = 0
  FROM generate_series(1, 300) c;

INSERT INTO legacy."Reports" ("Id", "CellId", "Date", "Subject", "Notes", "Visitors", "NumMembers", "NumVisitors",
  "Contribution", "WeekCellSkipped", "LeadershipId", "HostId", "TimothyId", "CellType", "CreatedBy", "CreationDate", "IsDeleted")
SELECT (c - 1) * 100 + k, c,
       (date '2024-12-29' + (k - 1) * 7 + (c % 7)) + time '20:00',
       CASE WHEN k % 10 <> 0 THEN 'Tema ' || k END,
       CASE WHEN k % 10 = 0 THEN 'Feriado' END,
       CASE WHEN k % 4 = 0 THEN 'Visitante A|Visitante B' END,
       5, CASE WHEN k % 4 = 0 THEN 2 ELSE 0 END, 12.5, k % 10 = 0, 100 + c, 700 + c, 400 + c, c % 3,
       'Operador Volume', (date '2024-12-29' + (k - 1) * 7 + (c % 7)) + time '21:00', k % 97 = 0
  FROM generate_series(1, 300) c CROSS JOIN generate_series(1, 100) k;

INSERT INTO legacy."ReportMembers" ("MemberId", "ReportId")
SELECT DISTINCT m, r."Id"
  FROM legacy."Reports" r
 CROSS JOIN LATERAL (VALUES (r."LeadershipId"), (r."HostId"), (r."TimothyId"),
                            (1001 + (r."Id" * 7) % 1200), (1001 + (r."Id" * 13) % 1200)) p(m)
 WHERE NOT r."WeekCellSkipped";
COMMIT;
