-- Schema do legado (g12app-net) para os testes locais, conforme o
-- AppDbContextModelSnapshot.cs (EF Core 8 + Pomelo, MySQL).
-- Só para o MySQL de teste em Docker. Nunca rode isto no banco do legado.

CREATE TABLE `__EFMigrationsHistory` (
  `MigrationId` varchar(150) NOT NULL,
  `ProductVersion` varchar(32) NOT NULL,
  PRIMARY KEY (`MigrationId`)
) CHARSET=utf8mb4;

CREATE TABLE `Addresses` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Street` longtext NULL,
  `Number` longtext NULL,
  `Neighborhood` longtext NULL,
  `City` longtext NULL,
  `State` longtext NULL,
  `PostalCode` longtext NULL,
  `Notes` longtext NULL,
  `CreatedBy` longtext NULL,
  `CreationDate` datetime(6) NULL,
  `LastModifiedBy` longtext NULL,
  `LastModifiedDate` datetime(6) NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`)
) CHARSET=utf8mb4;

CREATE TABLE `Members` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `Name` longtext NULL,
  `BirthDate` datetime(6) NULL,
  `MobileNumber` longtext NULL,
  `PhoneNumber` longtext NULL,
  `Email` longtext NULL,
  `CPF` longtext NULL,
  `Gender` int NOT NULL,
  `HomeAddressId` int NULL,
  `LeadershipId` int NULL,
  `SpouseId` int NULL,
  `Notes` longtext NULL,
  `Baptized` tinyint(1) NOT NULL,
  `BaptismDate` datetime(6) NULL,
  `HasNoLeadership` tinyint(1) NOT NULL,
  `Idle` tinyint(1) NOT NULL,
  `Password` longtext NULL,
  `Role` longtext NULL,
  `LeadershipTree` longtext NULL,
  `LeadershipIdTree` longtext NULL,
  `ComputedLeadershipName` longtext NULL,
  `ComputedG12Leader` longtext NULL,
  `ComputedG12LeaderId` int NULL,
  `ComputedG12LeaderSpouseId` int NULL,
  `MinistryLevel` int NULL,
  `TotalDisciples` int NULL,
  `TotalCells` int NULL,
  `ChildrenMembersComputed` tinyint(1) NOT NULL,
  `CreatedBy` longtext NULL,
  `CreationDate` datetime(6) NULL,
  `LastModifiedBy` longtext NULL,
  `LastModifiedDate` datetime(6) NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Members_HomeAddressId` (`HomeAddressId`),
  KEY `IX_Members_LeadershipId` (`LeadershipId`),
  UNIQUE KEY `IX_Members_SpouseId` (`SpouseId`),
  CONSTRAINT `FK_Members_Addresses_HomeAddressId` FOREIGN KEY (`HomeAddressId`) REFERENCES `Addresses` (`Id`),
  CONSTRAINT `FK_Members_Members_LeadershipId` FOREIGN KEY (`LeadershipId`) REFERENCES `Members` (`Id`),
  CONSTRAINT `FK_Members_Members_SpouseId` FOREIGN KEY (`SpouseId`) REFERENCES `Members` (`Id`)
) CHARSET=utf8mb4;

CREATE TABLE `Cells` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `LeadId` int NOT NULL,
  `TimothyId` int NOT NULL,
  `HostId` int NOT NULL,
  `WeekDay` int NOT NULL,
  `Time` longtext NULL,
  `PlaceId` int NULL,
  `CellType` int NOT NULL,
  `ReportMandatory` tinyint(1) NOT NULL,
  `CreatedBy` longtext NULL,
  `CreationDate` datetime(6) NULL,
  `LastModifiedBy` longtext NULL,
  `LastModifiedDate` datetime(6) NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Cells_HostId` (`HostId`),
  KEY `IX_Cells_LeadId` (`LeadId`),
  KEY `IX_Cells_PlaceId` (`PlaceId`),
  KEY `IX_Cells_TimothyId` (`TimothyId`),
  CONSTRAINT `FK_Cells_Addresses_PlaceId` FOREIGN KEY (`PlaceId`) REFERENCES `Addresses` (`Id`),
  CONSTRAINT `FK_Cells_Members_HostId` FOREIGN KEY (`HostId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Cells_Members_LeadId` FOREIGN KEY (`LeadId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Cells_Members_TimothyId` FOREIGN KEY (`TimothyId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE
) CHARSET=utf8mb4;

CREATE TABLE `Reports` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `CellId` int NOT NULL,
  `Date` datetime(6) NOT NULL,
  `Subject` longtext NULL,
  `Notes` longtext NULL,
  `Visitors` longtext NULL,
  `NumMembers` int NOT NULL,
  `NumVisitors` int NULL,
  `Contribution` decimal(65,30) NOT NULL,
  `WeekCellSkipped` tinyint(1) NOT NULL,
  `LeadershipId` int NOT NULL,
  `HostId` int NOT NULL,
  `TimothyId` int NOT NULL,
  `CellType` int NULL,
  `CreatedBy` longtext NULL,
  `CreationDate` datetime(6) NULL,
  `LastModifiedBy` longtext NULL,
  `LastModifiedDate` datetime(6) NULL,
  `IsDeleted` tinyint(1) NOT NULL,
  PRIMARY KEY (`Id`),
  KEY `IX_Reports_CellId` (`CellId`),
  KEY `IX_Reports_HostId` (`HostId`),
  KEY `IX_Reports_LeadershipId` (`LeadershipId`),
  KEY `IX_Reports_TimothyId` (`TimothyId`),
  CONSTRAINT `FK_Reports_Cells_CellId` FOREIGN KEY (`CellId`) REFERENCES `Cells` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Reports_Members_HostId` FOREIGN KEY (`HostId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Reports_Members_LeadershipId` FOREIGN KEY (`LeadershipId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Reports_Members_TimothyId` FOREIGN KEY (`TimothyId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE
) CHARSET=utf8mb4;

CREATE TABLE `ReportMembers` (
  `MemberId` int NOT NULL,
  `ReportId` int NOT NULL,
  PRIMARY KEY (`MemberId`, `ReportId`),
  KEY `IX_ReportMembers_ReportId` (`ReportId`),
  CONSTRAINT `FK_ReportMembers_Members_MemberId` FOREIGN KEY (`MemberId`) REFERENCES `Members` (`Id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ReportMembers_Reports_ReportId` FOREIGN KEY (`ReportId`) REFERENCES `Reports` (`Id`) ON DELETE CASCADE
) CHARSET=utf8mb4;

INSERT INTO `__EFMigrationsHistory` VALUES ('20240902192838_AddMemberG12SpouseId', '8.0.8');
