// Acesso ao MySQL do legado: somente leitura.
//
// A conexão do local.config tem privilégio de escrita (5.1 do plano). Por
// isso, além de só existir SELECT neste código:
// - toda consulta passa por assertReadOnlySql, que recusa qualquer outro verbo;
// - a sessão abre a transação com READ ONLY e WITH CONSISTENT SNAPSHOT: o
//   MySQL recusa escrita e todas as leituras veem o mesmo instante.

import mysql from 'mysql2';
import { LEGACY_TABLES, mapColumnType } from './legacy-schema.mjs';

const ALLOWED = /^\s*(SELECT|SHOW|SET\s+SESSION\s+TRANSACTION\s+(ISOLATION\s+LEVEL\s+REPEATABLE\s+READ|READ\s+ONLY)|START\s+TRANSACTION\s+READ\s+ONLY,\s*WITH\s+CONSISTENT\s+SNAPSHOT|ROLLBACK)\b/i;

export function assertReadOnlySql(sql) {
  if (!ALLOWED.test(sql) || /;\s*\S/.test(sql)) {
    throw new Error('Comando recusado: no legado só é permitido leitura.');
  }
}

export class LegacyReader {
  constructor(options) {
    this.conn = mysql.createConnection(options);
    this.p = this.conn.promise();
    // Sem este ouvinte, um erro de rede derrubaria o processo sem a
    // mensagem. Depois do destroy() o erro é esperado e ignorado; antes, ele
    // é guardado e devolvido na próxima chamada (com a causa real).
    this.destroyed = false;
    this.fatalError = null;
    this.conn.on('error', (err) => {
      if (!this.destroyed) this.fatalError = err;
    });
  }

  throwIfBroken() {
    if (this.fatalError) throw this.fatalError;
  }

  async query(sql, params = []) {
    assertReadOnlySql(sql);
    this.throwIfBroken();
    const [rows] = await this.p.query(sql, params);
    return rows;
  }

  /** Abre a transação somente leitura com snapshot consistente. */
  async begin({ requireSsl }) {
    if (requireSsl) {
      const rows = await this.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
      if (!rows[0]?.Value) throw new Error('A conexão com o legado não está usando SSL.');
    }
    await this.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await this.query('SET SESSION TRANSACTION READ ONLY');
    await this.query('START TRANSACTION READ ONLY, WITH CONSISTENT SNAPSHOT');
    const [info] = await this.query('SELECT VERSION() AS version, DATABASE() AS db');
    return info;
  }

  /**
   * Encerra a sessão. Depois de uma falha no meio de um stream, a conexão
   * pode estar pausada com um resultado pela metade: um ROLLBACK ficaria na
   * fila para sempre. Nesse caso a conexão é derrubada (a transação era só de
   * leitura; o servidor a descarta).
   */
  async end({ failed = false } = {}) {
    if (failed || this.fatalError) {
      this.destroyed = true;
      this.conn.destroy();
      return;
    }
    try {
      await this.query('ROLLBACK');
    } finally {
      await this.p.end().catch(() => {});
    }
  }

  /** Stream das linhas, em ordem de chave primária. */
  stream(sql) {
    assertReadOnlySql(sql);
    this.throwIfBroken();
    return this.conn.query({ sql }).stream({ highWaterMark: 500 });
  }

  /** Versão do schema (última migration EF), se a tabela existir. */
  async schemaVersion() {
    const tables = await this.query(
      "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = '__efmigrationshistory'",
    );
    if (!tables.length) return null;
    const rows = await this.query(
      `SELECT MigrationId AS id FROM \`${tables[0].t}\` ORDER BY MigrationId DESC LIMIT 1`,
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Descobre as tabelas esperadas (sem diferenciar maiúsculas), as colunas, a
   * chave primária e os índices. Para se faltar tabela ou coluna.
   */
  async discover() {
    const tables = await this.query(
      "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
    );
    const result = [];
    const warnings = [];
    for (const spec of LEGACY_TABLES) {
      const matches = tables.filter((r) => r.t.toLowerCase() === spec.name.toLowerCase());
      if (matches.length !== 1) {
        throw new Error(`Tabela ${spec.name} ${matches.length ? 'ambígua' : 'não encontrada'} no legado.`);
      }
      const sourceName = matches[0].t;
      const cols = await this.query(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE,
                DATETIME_PRECISION, COLUMN_KEY, ORDINAL_POSITION
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          ORDER BY ORDINAL_POSITION`,
        [sourceName],
      );
      const byLower = new Map(cols.map((c) => [c.COLUMN_NAME.toLowerCase(), c]));
      const missing = spec.columns.filter((c) => !byLower.has(c.toLowerCase()));
      if (missing.length) {
        throw new Error(`Colunas ausentes em ${spec.name}: ${missing.join(', ')}.`);
      }
      const canonical = new Map(spec.columns.map((c) => [c.toLowerCase(), c]));
      const columns = cols.map((c) => {
        const known = canonical.get(c.COLUMN_NAME.toLowerCase());
        if (!known) warnings.push(`Coluna a mais no legado, copiada também: ${spec.name}.${c.COLUMN_NAME}`);
        return {
          name: known ?? c.COLUMN_NAME,
          sourceName: c.COLUMN_NAME,
          columnType: c.COLUMN_TYPE,
          ...mapColumnType(c),
        };
      });
      const pk = await this.query(
        `SELECT COLUMN_NAME AS c FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
          ORDER BY ORDINAL_POSITION`,
        [sourceName],
      );
      if (!pk.length) throw new Error(`Tabela ${spec.name} sem chave primária no legado.`);
      const nameOf = (source) => columns.find((c) => c.sourceName === source).name;
      const idx = await this.query(
        `SELECT INDEX_NAME AS i, COLUMN_NAME AS c FROM information_schema.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME <> 'PRIMARY' AND COLUMN_NAME IS NOT NULL
          ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
        [sourceName],
      );
      const indexes = new Map();
      for (const r of idx) {
        if (!indexes.has(r.i)) indexes.set(r.i, []);
        indexes.get(r.i).push(nameOf(r.c));
      }
      result.push({
        name: spec.name,
        sourceName,
        columns,
        primaryKey: pk.map((r) => nameOf(r.c)),
        primaryKeySource: pk.map((r) => r.c),
        indexes: [...indexes.values()],
      });
    }
    return { tables: result, warnings };
  }
}
