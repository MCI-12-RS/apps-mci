// Tabelas do legado e mapeamento de tipos MySQL → Postgres.
//
// A lista de tabelas e colunas vem do AppDbContextModelSnapshot.cs do
// g12app-net (EF Core 8, última migration 20240902192838_AddMemberG12SpouseId).
// As colunas abaixo são as que o saneamento e a carga usam: se faltar uma, a
// cópia para. Coluna a mais na origem é copiada do mesmo jeito, com aviso.

export const LEGACY_TABLES = [
  {
    name: 'Addresses',
    columns: ['Id', 'City', 'CreatedBy', 'CreationDate', 'IsDeleted', 'LastModifiedBy', 'LastModifiedDate',
      'Neighborhood', 'Notes', 'Number', 'PostalCode', 'State', 'Street'],
  },
  {
    name: 'Members',
    columns: ['Id', 'BaptismDate', 'Baptized', 'BirthDate', 'CPF', 'ChildrenMembersComputed', 'ComputedG12Leader',
      'ComputedG12LeaderId', 'ComputedG12LeaderSpouseId', 'ComputedLeadershipName', 'CreatedBy', 'CreationDate',
      'Email', 'Gender', 'HasNoLeadership', 'HomeAddressId', 'Idle', 'IsDeleted', 'LastModifiedBy',
      'LastModifiedDate', 'LeadershipId', 'LeadershipIdTree', 'LeadershipTree', 'MinistryLevel', 'MobileNumber',
      'Name', 'Notes', 'Password', 'PhoneNumber', 'Role', 'SpouseId', 'TotalCells', 'TotalDisciples'],
  },
  {
    name: 'Cells',
    columns: ['Id', 'CellType', 'CreatedBy', 'CreationDate', 'HostId', 'IsDeleted', 'LastModifiedBy',
      'LastModifiedDate', 'LeadId', 'PlaceId', 'ReportMandatory', 'Time', 'TimothyId', 'WeekDay'],
  },
  {
    name: 'Reports',
    columns: ['Id', 'CellId', 'CellType', 'Contribution', 'CreatedBy', 'CreationDate', 'Date', 'HostId',
      'IsDeleted', 'LastModifiedBy', 'LastModifiedDate', 'LeadershipId', 'Notes', 'NumMembers', 'NumVisitors',
      'Subject', 'TimothyId', 'Visitors', 'WeekCellSkipped'],
  },
  {
    name: 'ReportMembers',
    columns: ['MemberId', 'ReportId'],
  },
];

export const LEGACY_SCHEMA = 'legacy';
export const RUNS_TABLE = '_copy_runs';

export const qPg = (ident) => `"${String(ident).replaceAll('"', '""')}"`;
export const qMy = (ident) => `\`${String(ident).replaceAll('`', '``')}\``;

/**
 * Tipo Postgres de uma coluna do MySQL (linha de information_schema.COLUMNS).
 * kind decide a conversão do valor e a expressão do checksum.
 */
export function mapColumnType(col) {
  const dataType = col.DATA_TYPE.toLowerCase();
  const columnType = col.COLUMN_TYPE.toLowerCase();
  const unsigned = columnType.includes('unsigned');
  const precision = col.NUMERIC_PRECISION == null ? null : Number(col.NUMERIC_PRECISION);
  const scale = col.NUMERIC_SCALE == null ? null : Number(col.NUMERIC_SCALE);
  const fsp = col.DATETIME_PRECISION == null ? 0 : Math.min(Number(col.DATETIME_PRECISION), 6);
  if ((dataType === 'tinyint' && /^tinyint\(1\)/.test(columnType)) || (dataType === 'bit' && /^bit\(1\)/.test(columnType))) {
    return { kind: 'bool', pgType: 'boolean' };
  }
  switch (dataType) {
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'year':
      return { kind: 'int', pgType: 'integer' };
    case 'int':
    case 'integer':
      return unsigned ? { kind: 'int', pgType: 'bigint' } : { kind: 'int', pgType: 'integer' };
    case 'bigint':
      return unsigned ? { kind: 'int', pgType: 'numeric(20,0)' } : { kind: 'int', pgType: 'bigint' };
    case 'decimal':
    case 'numeric':
      return { kind: 'numeric', pgType: `numeric(${precision},${scale})` };
    case 'float':
      return { kind: 'float', pgType: 'real' };
    case 'double':
    case 'real':
      return { kind: 'float', pgType: 'double precision' };
    case 'datetime':
    case 'timestamp':
      // Sem fuso, exatamente como gravado (o legado grava horário de Brasília).
      return { kind: 'timestamp', pgType: `timestamp(${fsp}) without time zone` };
    case 'date':
      return { kind: 'date', pgType: 'date' };
    case 'time':
      return { kind: 'time', pgType: `time(${fsp}) without time zone` };
    case 'char':
    case 'varchar':
    case 'tinytext':
    case 'text':
    case 'mediumtext':
    case 'longtext':
    case 'enum':
    case 'set':
      return { kind: 'text', pgType: 'text' };
    case 'binary':
    case 'varbinary':
    case 'tinyblob':
    case 'blob':
    case 'mediumblob':
    case 'longblob':
      return { kind: 'bytes', pgType: 'bytea' };
    case 'json':
      return { kind: 'json', pgType: 'jsonb' };
    default:
      throw new Error(`Tipo MySQL sem mapeamento: ${col.TABLE_NAME}.${col.COLUMN_NAME} (${columnType})`);
  }
}

// Data "zero" do MySQL (0000-00-00, mês ou dia 00): não existe no Postgres.
const ZERO_DATE = /^0000-|^\d{4}-00-|^\d{4}-\d{2}-00/;

/**
 * Converte um valor lido pelo mysql2 para o JSON que o
 * jsonb_populate_recordset grava. stats acumula o que precisou ser ajustado.
 */
export function convertValue(kind, value, stats) {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool':
      if (Buffer.isBuffer(value)) return value.some((b) => b !== 0);
      return Number(value) !== 0;
    case 'int':
    case 'numeric':
    case 'float':
      return value;
    case 'timestamp':
    case 'date':
      if (ZERO_DATE.test(String(value))) {
        stats.zeroDates += 1;
        return null;
      }
      return String(value);
    case 'time':
      return String(value);
    case 'text': {
      const text = String(value);
      if (text.includes('\u0000')) {
        stats.nulCharsRemoved += 1;
        return text.replaceAll('\u0000', '');
      }
      return text;
    }
    case 'bytes':
      return `\\x${Buffer.from(value).toString('hex')}`;
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    default:
      throw new Error(`Tipo desconhecido: ${kind}`);
  }
}

// --- Checksum origem × destino ----------------------------------------------
// Para cada linha: md5 da concatenação das colunas em forma canônica (separador
// chr(31), nulo como chr(30)); o checksum da tabela é a soma dos 60 primeiros
// bits de cada md5 (independe da ordem), com a contagem na frente.
// float e json ficam de fora (a forma textual difere entre os bancos).

const MY_NULL = 'CHAR(30 USING utf8mb4)';
const MY_SEP = 'CHAR(31 USING utf8mb4)';

function myZeroGuard(c, expr) {
  return `IF(${c} IS NULL OR YEAR(${c}) = 0 OR MONTH(${c}) = 0 OR DAY(${c}) = 0, NULL, ${expr})`;
}

export function mysqlChecksumExpr(column) {
  const c = qMy(column.sourceName);
  switch (column.kind) {
    case 'bool':
      return `CAST(CAST(${c} AS UNSIGNED) AS CHAR)`;
    case 'int':
    case 'numeric':
      return `CAST(${c} AS CHAR)`;
    case 'time':
      return `TIME_FORMAT(${c}, '%H:%i:%s.%f')`;
    case 'timestamp':
      return myZeroGuard(c, `DATE_FORMAT(${c}, '%Y-%m-%d %H:%i:%s.%f')`);
    case 'date':
      return myZeroGuard(c, `DATE_FORMAT(${c}, '%Y-%m-%d')`);
    case 'text':
      return `REPLACE(CONVERT(${c} USING utf8mb4), CHAR(0 USING utf8mb4), '')`;
    case 'bytes':
      return `HEX(${c})`;
    default:
      return null;
  }
}

export function pgChecksumExpr(column) {
  const c = qPg(column.name);
  switch (column.kind) {
    case 'bool':
      return `(${c})::int::text`;
    case 'int':
    case 'numeric':
      return `(${c})::text`;
    case 'time':
      return `to_char(${c}, 'HH24:MI:SS.US')`;
    case 'timestamp':
      return `to_char(${c}, 'YYYY-MM-DD HH24:MI:SS.US')`;
    case 'date':
      return `to_char(${c}, 'YYYY-MM-DD')`;
    case 'text':
      return c;
    case 'bytes':
      return `upper(encode(${c}, 'hex'))`;
    default:
      return null;
  }
}

export function mysqlChecksumSql(table) {
  const parts = table.columns.map(mysqlChecksumExpr).filter(Boolean).map((e) => `COALESCE(${e}, ${MY_NULL})`);
  const row = `MD5(CONCAT_WS(${MY_SEP}, ${parts.join(', ')}))`;
  return `SELECT COUNT(*) AS n, CAST(COALESCE(SUM(CAST(CONV(SUBSTRING(${row}, 1, 15), 16, 10) AS UNSIGNED)), 0) AS CHAR) AS s FROM ${qMy(table.sourceName)}`;
}

export function pgChecksumSql(table) {
  const parts = table.columns.map(pgChecksumExpr).filter(Boolean).map((e) => `coalesce(${e}, chr(30))`);
  const row = `md5(concat_ws(chr(31), ${parts.join(', ')}))`;
  return `SELECT count(*)::text AS n, coalesce(sum(('x' || substr(${row}, 1, 15))::bit(60)::bigint), 0)::text AS s FROM ${qPg(LEGACY_SCHEMA)}.${qPg(table.name)}`;
}

export const checksumExcluded = (table) =>
  table.columns.filter((c) => !mysqlChecksumExpr(c)).map((c) => c.name);
