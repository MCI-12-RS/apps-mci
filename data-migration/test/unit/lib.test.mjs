// Testes unitários (sem banco): node --test test/unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConfigText, parseAdoConnectionString, postgresOptions, mysqlOptions, ConfigError, EXPECTED_PROJECT_REF,
} from '../../src/lib/config.mjs';
import { assertReadOnlySql } from '../../src/lib/mysql.mjs';
import { convertValue, mapColumnType } from '../../src/lib/legacy-schema.mjs';
import { safeErrorMessage } from '../../src/lib/cli.mjs';

const pgBase = (over = {}) => new Map(Object.entries({
  SUPABASE_PROJECT_REF: EXPECTED_PROJECT_REF,
  SUPABASE_HOST: 'aws-0-sa-east-1.pooler.supabase.com',
  SUPABASE_PORT: '5432',
  SUPABASE_DB: 'postgres',
  SUPABASE_USER: `postgres.${EXPECTED_PROJECT_REF}`,
  SUPABASE_PASS: 'x',
  ...over,
}));

test('local.config: aspas, export e comentários', () => {
  const v = parseConfigText('# c\nA="1; 2"\nexport B=\'x\'\nC = sem aspas \n\nD=');
  assert.equal(v.get('A'), '1; 2');
  assert.equal(v.get('B'), 'x');
  assert.equal(v.get('C'), 'sem aspas');
  assert.equal(v.get('D'), '');
});

test('connection string ADO.NET', () => {
  const cs = parseAdoConnectionString('Server=db.exemplo; Port=25060; Uid=u; Password="p;a""ss"; Database=g12; SslMode=Required;');
  assert.deepEqual(
    { host: cs.host, port: cs.port, user: cs.user, password: cs.password, database: cs.database, sslMode: cs.sslMode },
    { host: 'db.exemplo', port: 25060, user: 'u', password: 'p;a"ss', database: 'g12', sslMode: 'required' },
  );
});

test('legado: SSL obrigatório fora da máquina local', () => {
  const values = new Map([['LEGACY_PROD_CONNSTRING', 'Server=db.exemplo; Uid=u; Password=p; Database=g; SslMode=None;']]);
  assert.throws(() => mysqlOptions(values), ConfigError);
  values.set('LEGACY_PROD_CONNSTRING', 'Server=db.exemplo; Uid=u; Password=p; Database=g; SslMode=Required;');
  const o = mysqlOptions(values);
  assert.equal(o.options.ssl.rejectUnauthorized, false);
  assert.equal(o.options.dateStrings, true);
  assert.equal(o.options.multipleStatements, false);
});

test('destino: recusa outro projeto, outro host e usuário errado no pooler', () => {
  assert.throws(() => postgresOptions(pgBase({ SUPABASE_PROJECT_REF: 'clfgjnwtzasdsrgcxmmd' })), ConfigError);
  assert.throws(() => postgresOptions(pgBase({ SUPABASE_HOST: 'evil.example.com' })), ConfigError);
  assert.throws(() => postgresOptions(pgBase({ SUPABASE_USER: 'postgres.clfgjnwtzasdsrgcxmmd' })), ConfigError);
  assert.equal(postgresOptions(pgBase()).describe.ssl, true);
  assert.equal(postgresOptions(pgBase({ SUPABASE_HOST: '127.0.0.1', SUPABASE_USER: 'postgres' })).describe.local, true);
  assert.equal(postgresOptions(pgBase({ SUPABASE_HOST: `db.${EXPECTED_PROJECT_REF}.supabase.co`, SUPABASE_USER: 'postgres' })).describe.ssl, true);
});

test('erros de configuração não citam a senha', () => {
  try {
    postgresOptions(pgBase({ SUPABASE_PROJECT_REF: 'outro', SUPABASE_PASS: 'segredo-123' }));
  } catch (err) {
    assert.doesNotMatch(err.message, /segredo-123/);
  }
});

test('legado: só leitura', () => {
  for (const ok of ['SELECT 1', ' select * from x', "SHOW SESSION STATUS LIKE 'Ssl_cipher'",
    'SET SESSION TRANSACTION READ ONLY', 'SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ',
    'START TRANSACTION READ ONLY, WITH CONSISTENT SNAPSHOT', 'ROLLBACK']) {
    assert.doesNotThrow(() => assertReadOnlySql(ok), ok);
  }
  for (const bad of ['UPDATE Members SET Name = 1', 'DELETE FROM Members', 'INSERT INTO x VALUES (1)',
    'SET SESSION sql_mode = ""', 'START TRANSACTION', 'COMMIT', 'SELECT 1; DELETE FROM Members',
    'CREATE TABLE x (a int)', 'DROP TABLE Members', 'CALL proc()', 'LOCK TABLES Members WRITE']) {
    assert.throws(() => assertReadOnlySql(bad), bad);
  }
});

test('tipos: mapeamento', () => {
  const col = (DATA_TYPE, COLUMN_TYPE, extra = {}) => ({ TABLE_NAME: 't', COLUMN_NAME: 'c', DATA_TYPE, COLUMN_TYPE, ...extra });
  assert.equal(mapColumnType(col('tinyint', 'tinyint(1)')).pgType, 'boolean');
  assert.equal(mapColumnType(col('int', 'int')).pgType, 'integer');
  assert.equal(mapColumnType(col('decimal', 'decimal(65,30)', { NUMERIC_PRECISION: 65, NUMERIC_SCALE: 30 })).pgType, 'numeric(65,30)');
  assert.equal(mapColumnType(col('datetime', 'datetime(6)', { DATETIME_PRECISION: 6 })).pgType, 'timestamp(6) without time zone');
  assert.equal(mapColumnType(col('longtext', 'longtext')).pgType, 'text');
  assert.throws(() => mapColumnType(col('geometry', 'geometry')));
});

test('valores: datas zero, caractere nulo e booleanos', () => {
  const stats = { zeroDates: 0, nulCharsRemoved: 0, nonBinaryBooleans: 0 };
  assert.equal(convertValue('timestamp', '0000-00-00 00:00:00.000000', stats), null);
  assert.equal(convertValue('timestamp', '2024-00-10 00:00:00', stats), null);
  assert.equal(convertValue('timestamp', '2024-05-01 10:11:12.345678', stats), '2024-05-01 10:11:12.345678');
  assert.equal(stats.zeroDates, 2);
  assert.equal(convertValue('text', 'a\u0000b', stats), 'ab');
  assert.equal(stats.nulCharsRemoved, 1);
  assert.equal(convertValue('bool', 0, stats), false);
  assert.equal(convertValue('bool', 1, stats), true);
  assert.equal(convertValue('bool', Buffer.from([1]), stats), true);
  assert.equal(convertValue('bool', 2, stats), true);
  assert.equal(stats.nonBinaryBooleans, 1);
  assert.equal(convertValue('numeric', '1.500000000000000000000000000000', stats), '1.500000000000000000000000000000');
  assert.equal(convertValue('int', null, stats), null);
});

test('mensagem de erro sem valor de coluna', () => {
  const msg = safeErrorMessage(Object.assign(new Error('invalid input syntax for type timestamp: "fulano@x.com"'), { code: '22007' }));
  assert.doesNotMatch(msg, /fulano/);
  assert.match(msg, /22007/);
});
