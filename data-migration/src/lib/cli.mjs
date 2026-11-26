// Utilitários de linha de comando: argumentos, saída e erros sem dados pessoais.

import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { ConfigError, REPO_ROOT } from './config.mjs';

export function parseCli(extraOptions = {}, usage = '') {
  const { values } = parseArgs({
    options: {
      config: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      ...extraOptions,
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(`${usage.trim()}\n`);
    process.exit(0);
  }
  return values;
}

export const log = (msg = '') => process.stdout.write(`${msg}\n`);
export const warn = (msg) => process.stderr.write(`AVISO: ${msg}\n`);

/**
 * Mensagem de erro segura: só o código e o texto principal. Mensagens de
 * driver que costumam citar o valor de uma coluna (sintaxe inválida, valor
 * fora do intervalo, violação de constraint) perdem tudo depois do primeiro
 * ':'. DETAIL, WHERE e a pilha nunca são impressos.
 */
export function safeErrorMessage(err) {
  if (err instanceof ConfigError) return err.message;
  const code = err?.code ? `[${err.code}] ` : '';
  let message = String(err?.message ?? err);
  if (/invalid input|out of range|violates|invalid byte|value too long|malformed|syntax for type/i.test(message)) {
    message = `${message.split(':')[0]}: (valor omitido)`;
  }
  return `${code}${message}`;
}

export async function runMain(main) {
  try {
    await main();
  } catch (err) {
    process.stderr.write(`ERRO: ${safeErrorMessage(err)}\n`);
    process.exitCode = 1;
  }
}

/** Commit atual do repositório (melhor esforço; só para registro). */
export function gitCommit() {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export const formatInt = (n) => Number(n).toLocaleString('pt-BR');
