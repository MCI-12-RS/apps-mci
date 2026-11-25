-- Massa FICTÍCIA para os testes locais do saneamento (nenhum dado real).
-- Cada caso está comentado em test/expected-sanitation.json.
SET SESSION FOREIGN_KEY_CHECKS = 0;
SET SESSION sql_mode = '';
INSERT INTO `Addresses` (`Id`,`Street`,`Number`,`Neighborhood`,`City`,`State`,`PostalCode`,`Notes`,`CreationDate`,`IsDeleted`) VALUES
 (1,'Rua Exemplo','100','Centro','Cidade Ficticia','rs','90000-000',NULL,'2024-01-02 03:04:05.000000',0),
 (2,'Rua Teste','200','Bairro Teste','Cidade Ficticia','RS','90000000',CONCAT('antes',CHAR(0),'depois'),NULL,0);
INSERT INTO `Members` (`Id`,`Name`,`Gender`,`Email`,`MobileNumber`,`CPF`,`BirthDate`,`LeadershipId`,`SpouseId`,`HasNoLeadership`,`Idle`,`Baptized`,`BaptismDate`,`HomeAddressId`,`Password`,`Role`,`ChildrenMembersComputed`,`CreationDate`,`IsDeleted`,`Notes`) VALUES
 (1,'Bruno Ficticio1',0,'pastor.a@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',NULL,2,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppSuperAdmin',0,'2024-05-01 10:11:12.345678',0,'Observação com acentuação ✓ e emoji 🙂'),
 (2,'Carla Ficticio2',1,'m2@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',NULL,1,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (3,'Diego Ficticio3',0,'m3@exemplo.org','51999990003',NULL,'1990-01-01 00:00:00.000000',1,4,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (4,'Elisa Ficticio4',1,'m4@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',2,3,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (5,'Fabio Ficticio5',1,'dup@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (6,'Gina Ficticio6',0,' DUP@Exemplo.org ',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (7,'Hugo Ficticio7',1,'m7@exemplo.org','51999990002',NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (8,'Iris Ficticio8',0,'m8@exemplo.org','(51) 9999-0002',NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (9,'Joao Ficticio9',1,'m9@exemplo.org',NULL,'529.982.247-25','1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (10,'Ana Ficticio10',0,'m10@exemplo.org',NULL,'52998224725','1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (11,'Bruno Ficticio11',1,'m11@exemplo.org',NULL,'12345678900','1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (12,'Carla Ficticio12',0,'m12@exemplo.org',NULL,'111.111.111-11','1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (13,'Diego Ficticio13',1,'sem-arroba.exemplo.org','51999990013',NULL,'1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (14,'Elisa Ficticio14',0,'x14@mci12fakemail.com',NULL,NULL,'1990-01-01 00:00:00.000000',4,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (15,'Fabio Ficticio15',1,NULL,'12345',NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (16,'Gina Ficticio16',0,'m16@exemplo.org','999',NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (17,'Joaquim',1,'m17@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (18,'   ',0,'m18@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (19,'Joao Ficticio19',2,'m19@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (20,'Ana Ficticio20',0,'m20@exemplo.org',NULL,NULL,'2099-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (21,'Bruno Ficticio21',1,'m21@exemplo.org',NULL,NULL,'1900-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (22,'Carla Ficticio22',0,'m22@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',NULL,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (23,'Diego Ficticio23',1,'m23@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',22,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (24,'Elisa Ficticio24',0,'m24@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',NULL,NULL,1,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (25,'Fabio Ficticio25',1,'m25@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',24,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (26,'Gina Ficticio26',0,'m26@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,1,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (27,'Hugo Ficticio27',1,'m27@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',28,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (28,'Iris Ficticio28',0,'m28-excluido@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',1,NULL),
 (29,'Joao Ficticio29',1,'m29@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',9999,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (30,'Ana Ficticio30',0,'m30@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',31,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (31,'Bruno Ficticio31',1,'m31@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',32,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (32,'Carla Ficticio32',0,'m32@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',30,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (33,'Diego Ficticio33',1,'m33@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,33,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (34,'Elisa Ficticio34',0,'m34@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,28,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (35,'Fabio Ficticio35',1,'m35@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,36,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (36,'Gina Ficticio36',0,'m36@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,37,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (37,'Hugo Ficticio37',1,'m37@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (38,'Iris Ficticio38',0,'m38@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,8888,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (39,'Joao Ficticio39',1,'m39@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,NULL,'AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (40,'Ana Ficticio40',0,'m40@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,0,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (41,'Bruno Ficticio41',1,'m41@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',7777,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (42,'Carla Ficticio42',0,'m42@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,1,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',0,NULL),
 (43,'Diego Ficticio43',1,'m43@exemplo.org',NULL,'000','1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',1,NULL),
 (44,'Elisa Ficticio44',0,'dup@exemplo.org',NULL,NULL,'1990-01-01 00:00:00.000000',3,NULL,0,0,1,'2010-05-05 00:00:00.000000',1,'0123456789abcdef0123456789abcdef','AppUser',0,'2024-05-01 10:11:12.345678',1,NULL);

INSERT INTO `Cells` (`Id`,`LeadId`,`TimothyId`,`HostId`,`WeekDay`,`Time`,`PlaceId`,`CellType`,`ReportMandatory`,`CreationDate`,`IsDeleted`) VALUES
 (1, 3, 5, 6, 3, '20:00', 1, 0, 0, '2024-02-01 08:00:00.000000', 0),
 (2, 4, 9, 10, 2, '8h', 1, 1, 0, NULL, 0),
 (3, 3, 5, 6, 9, '19:00', 1, 0, 0, NULL, 0),
 (4, 3, 5, 6, 1, '19:00', 1, 5, 0, NULL, 0),
 (5, 3, 9999, 6, 1, '19:00', 1, 0, 0, NULL, 0),
 (6, 3, 5, 28, 1, '19:00', 1, 0, 0, NULL, 0),
 (7, 9998, 5, 6, 1, '19:30', 1, 2, 1, NULL, 1),
 (8, 42, 5, 6, 4, '19:00', 2, 0, 0, NULL, 0),
 (9, 3, 5, 6, 5, '19:00', 7777, 0, 0, NULL, 0),
 (10, 4, 9, 10, 6, '9:30', NULL, 1, 0, NULL, 0);

INSERT INTO `Reports` (`Id`,`CellId`,`Date`,`Subject`,`Notes`,`Visitors`,`NumMembers`,`NumVisitors`,`Contribution`,`WeekCellSkipped`,`LeadershipId`,`HostId`,`TimothyId`,`CellType`,`CreationDate`,`IsDeleted`) VALUES
 (1, 1, '2026-11-02 20:00:00.000000', 'Tema 1', NULL, 'Visitante A|Visitante B', 3, 2, 10.50, 0, 3, 6, 5, 0, '2026-11-02 21:00:00.000000', 0),
 (2, 1, '2026-11-05 20:00:00.000000', 'Tema 2', NULL, NULL, 1, 0, 0, 0, 3, 6, 5, 0, NULL, 0),
 (3, 1, '2026-11-07 20:00:00.000000', 'Tema 3', NULL, NULL, 0, 0, 0, 0, 3, 6, 5, 0, NULL, 1),
 (4, 1, '2026-11-08 20:00:00.000000', 'Tema 4', NULL, NULL, 2, NULL, 5, 0, 3, 6, 5, 0, NULL, 0),
 (5, 9999, '2026-10-01 20:00:00.000000', 'Tema 5', NULL, NULL, 0, 0, 0, 0, 3, 6, 5, 0, NULL, 0),
 (6, 2, '0000-00-00 00:00:00.000000', NULL, 'Sem data', NULL, 0, 0, 0, 1, 4, 10, 9, 1, NULL, 0),
 (7, 2, '2026-10-06 08:00:00.000000', 'Tema 7', NULL, NULL, 0, 0, 0, 0, 9999, 10, 9, 1, NULL, 0),
 (8, 2, '2026-10-13 08:00:00.000000', 'Tema 8', NULL, NULL, 0, 0, 0, 0, 4, 10, 9, 7, NULL, 0),
 (9, 8, '2099-12-31 19:00:00.000000', 'Tema 9', NULL, NULL, 0, 0, 0, 0, 42, 6, 5, 0, NULL, 0),
 (10, 8, '2026-10-01 19:00:00.000000', 'Tema 10', NULL, 'A| |', 5, 3, 0, 0, 42, 6, 5, 0, NULL, 0),
 (11, 9, '2026-10-02 19:00:00.000000', 'Tema 11', NULL, NULL, 0, 0, 1.005, 0, 3, 6, 5, 0, NULL, 0),
 (12, 7, '2026-09-01 19:30:00.000000', 'Tema 12', NULL, NULL, 0, 0, 0, 0, 9998, 6, 5, 2, NULL, 0);

INSERT INTO `ReportMembers` (`MemberId`,`ReportId`) VALUES
 (3, 1), (5, 1), (6, 1),
 (3, 2),
 (9997, 4), (28, 4),
 (42, 10),
 (3, 9996);
