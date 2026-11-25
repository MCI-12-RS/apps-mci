// Leitura do local.config e montagem das conexões.
//
// Regras (CLAUDE.md da raiz):
// - o local.config é lido como arquivo; nada é exportado para process.env
//   (a Supabase CLI leria qualquer SUPABASE_* como configuração dela);
// - nenhuma credencial é impressa, gravada ou devolvida em mensagem de erro;
// - o destino precisa ser o projeto gkhnjhmgeceoaqeynhrj (ou a stack local).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PROJECT_REF = 'gkhnjhmgeceoaqeynhrj';

const here = dirname(fileURLToPath(import.meta.url));
/** Pasta data-migration/ */
export const MIGRATION_ROOT = resolve(here, '..', '..');
/** Raiz do repositório apps-mci */
export const REPO_ROOT = resolve(MIGRATION_ROOT, '..');

export class ConfigError extends Error {}

/**
 * Caminho do arquivo de configuração: --config, depois MCI_LOCAL_CONFIG,
 * depois <raiz>/local.config.
 */
export function resolveConfigPath(cliValue) {
  const candidate = cliValue || process.env.MCI_LOCAL_CONFIG || resolve(REPO_ROOT, 'local.config');
  const path = resolve(candidate);
  if (!existsSync(path)) {
    throw new ConfigError(`Arquivo de configuração não encontrado: ${path}`);
  }
  return path;
}

/** Lê KEY=VALUE (aceita "export ", comentários com # e aspas em volta do valor). */
export function parseConfigText(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

export function loadConfig(cliValue) {
  const path = resolveConfigPath(cliValue);
  return { path, values: parseConfigText(readFileSync(path, 'utf8')) };
}

function required(values, key) {
  const value = values.get(key);
  if (value === undefined || value === '') {
    throw new ConfigError(`Falta a chave ${key} no arquivo de configuração.`);
  }
  return value;
}

/**
 * Connection string ADO.NET (MySqlConnector): `Server=…; Port=…; Uid=…;
 * Password=…; Database=…; SslMode=Required;`. Aceita valores entre aspas.
 */
export function parseAdoConnectionString(text) {
  const out = new Map();
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /[\s;]/.test(text[i])) i++;
    if (i >= text.length) break;
    const eq = text.indexOf('=', i);
    if (eq < 0) throw new ConfigError('Connection string do legado mal formada.');
    const key = text.slice(i, eq).trim().toLowerCase().replace(/\s+/g, ' ');
    i = eq + 1;
    while (i < text.length && text[i] === ' ') i++;
    let value = '';
    if (text[i] === '"' || text[i] === "'") {
      const quote = text[i++];
      for (;;) {
        if (i >= text.length) throw new ConfigError('Connection string do legado mal formada (aspas).');
        if (text[i] === quote) {
          if (text[i + 1] === quote) { value += quote; i += 2; continue; }
          i++;
          break;
        }
        value += text[i++];
      }
      while (i < text.length && text[i] !== ';') i++;
    } else {
      const end = text.indexOf(';', i);
      value = (end < 0 ? text.slice(i) : text.slice(i, end)).trim();
      i = end < 0 ? text.length : end;
    }
    out.set(key, value);
  }
  const pick = (...keys) => keys.map((k) => out.get(k)).find((v) => v !== undefined && v !== '');
  return {
    host: pick('server', 'host', 'data source', 'datasource', 'address', 'addr'),
    port: Number(pick('port') ?? 3306),
    user: pick('uid', 'user id', 'userid', 'user', 'username', 'user name'),
    password: pick('password', 'pwd') ?? '',
    database: pick('database', 'initial catalog'),
    sslMode: (pick('sslmode', 'ssl mode') ?? 'Preferred').toLowerCase(),
    sslCa: pick('sslca', 'ssl ca', 'ssl-ca'),
  };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);
export const isLocalHost = (host) => LOCAL_HOSTS.has(String(host).toLowerCase());

/** Opções do mysql2 para o legado. SSL obrigatório fora da máquina local. */
export function mysqlOptions(values) {
  const cs = parseAdoConnectionString(required(values, 'LEGACY_PROD_CONNSTRING'));
  if (!cs.host || !cs.user || !cs.database) {
    throw new ConfigError('LEGACY_PROD_CONNSTRING precisa de Server, Uid e Database.');
  }
  const caPath = values.get('LEGACY_PROD_SSL_CA') || cs.sslCa;
  let ssl;
  let sslVerified = false;
  if (cs.sslMode === 'none' || cs.sslMode === 'disabled') {
    if (!isLocalHost(cs.host)) {
      throw new ConfigError('SSL desligado na conexão do legado: só é aceito para um MySQL local de teste.');
    }
  } else {
    const ca = caPath ? readFileSync(resolve(caPath), 'utf8') : undefined;
    const verify = cs.sslMode === 'verifyca' || cs.sslMode === 'verifyfull' || Boolean(ca);
    if (verify && !ca && (cs.sslMode === 'verifyca')) {
      throw new ConfigError('SslMode=VerifyCA precisa de LEGACY_PROD_SSL_CA (o certificado da CA do banco).');
    }
    ssl = { rejectUnauthorized: verify };
    if (ca) ssl.ca = ca;
    if (cs.sslMode === 'verifyca') ssl.checkServerIdentity = () => undefined;
    sslVerified = verify;
  }
  return {
    describe: { host: cs.host, port: cs.port, database: cs.database, ssl: Boolean(ssl), sslVerified },
    options: {
      host: cs.host,
      port: cs.port,
      user: cs.user,
      password: cs.password,
      database: cs.database,
      ssl,
      // Valores fiéis: DATETIME como texto (sem conversão de fuso), DECIMAL e
      // BIGINT como texto (sem perda de precisão).
      dateStrings: true,
      decimalNumbers: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
      multipleStatements: false,
      charset: 'utf8mb4_general_ci',
      connectTimeout: 20000,
    },
  };
}

/**
 * Opções do pg para o Supabase. Confere o project ref e o host:
 * Session pooler (`*.pooler.supabase.com`, usuário `postgres.<ref>`),
 * conexão direta `db.<ref>.supabase.co` ou a stack local.
 */
export function postgresOptions(values) {
  const ref = required(values, 'SUPABASE_PROJECT_REF');
  if (ref !== EXPECTED_PROJECT_REF) {
    throw new ConfigError(
      `SUPABASE_PROJECT_REF não é o banco do app (${EXPECTED_PROJECT_REF}). Confira o arquivo de configuração.`,
    );
  }
  const host = required(values, 'SUPABASE_HOST');
  const port = Number(values.get('SUPABASE_PORT') || 5432);
  const user = required(values, 'SUPABASE_USER');
  const database = values.get('SUPABASE_DB') || 'postgres';
  const password = required(values, 'SUPABASE_PASS');
  const lower = host.toLowerCase();
  const local = isLocalHost(lower);
  if (!local) {
    const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(lower);
    const direct = lower === `db.${ref}.supabase.co`;
    if (!pooler && !direct) {
      throw new ConfigError('SUPABASE_HOST não é o Session pooler do Supabase nem a stack local.');
    }
    if (pooler && user !== `postgres.${ref}`) {
      throw new ConfigError(`No pooler, SUPABASE_USER precisa ser postgres.${ref}.`);
    }
  }
  const caPath = values.get('SUPABASE_SSL_CA');
  let ssl = false;
  if (!local) {
    ssl = caPath
      ? { rejectUnauthorized: true, ca: readFileSync(resolve(caPath), 'utf8') }
      : { rejectUnauthorized: false };
  }
  return {
    describe: { host, port, database, local, ssl: Boolean(ssl), sslVerified: Boolean(caPath) && !local },
    options: {
      host,
      port,
      user,
      password,
      database,
      ssl,
      application_name: 'mci-data-migration',
      connectionTimeoutMillis: 20000,
    },
  };
}
