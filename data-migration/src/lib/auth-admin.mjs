// Admin API do Auth do Supabase (E4.08, `npm run accounts`), por fetch, sem dependência nova.
//
// Só o que a criação das contas precisa: conferir a chave, criar a conta (id = id do
// membro, e-mail técnico, sem senha) e ler uma conta pelo id. Nenhuma resposta é
// impressa: o erro sai só com o status HTTP e o error_code do Auth (o corpo pode
// citar o e-mail ou o id). A chave nunca vai para mensagem nenhuma.

const REQUEST_TIMEOUT_MS = 20000;

export class AuthAdminError extends Error {
  constructor(status, code) {
    super(`Auth respondeu ${status}${code ? ` (${code})` : ''}`);
    this.status = status;
    this.authCode = code ?? null;
  }
}

/** error_code do corpo de erro do Auth (GoTrue), sem o texto. */
export function authErrorCode(body) {
  if (!body || typeof body !== 'object') return null;
  const v = body.error_code ?? body.code ?? null;
  return v == null ? null : String(v).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || null;
}

export function createAuthAdmin({ baseUrl, key }, { fetchImpl = globalThis.fetch, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  async function call(method, path, body) {
    let res;
    try {
      res = await fetchImpl(`${baseUrl}/auth/v1${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Rede ou tempo-limite: status 0 (o chamador decide se tenta de novo).
      throw new AuthAdminError(0, err?.name === 'TimeoutError' ? 'timeout' : 'network');
    }
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) throw new AuthAdminError(res.status, authErrorCode(json));
    return json;
  }

  return {
    /**
     * A chave vale para a Admin API: lê uma conta que não existe (404 = chave aceita). Não
     * lista contas (a lista quebra no Auth com uma linha de auth.users gravada fora dele).
     */
    async ping() {
      try {
        await call('GET', '/admin/users/00000000-0000-4000-8000-000000000000');
      } catch (err) {
        if (err instanceof AuthAdminError && err.status === 404) return;
        throw err;
      }
    },
    /** Conta sem senha (RN-08 do E2.03), com o e-mail confirmado e o Id do legado no app_metadata (6.2). */
    async createAccount({ id, email, legacyId }) {
      const user = await call('POST', '/admin/users', {
        id, email, email_confirm: true, app_metadata: { legacy_member_id: legacyId },
      });
      return { id: user?.id ?? null, email: user?.email ?? null, legacyId: user?.app_metadata?.legacy_member_id ?? null };
    },
    /** A conta pelo id, ou null se não existe. */
    async getAccount(id) {
      try {
        const user = await call('GET', `/admin/users/${encodeURIComponent(id)}`);
        return { id: user?.id ?? null, email: user?.email ?? null, legacyId: user?.app_metadata?.legacy_member_id ?? null };
      } catch (err) {
        if (err instanceof AuthAdminError && err.status === 404) return null;
        throw err;
      }
    },
    /** Só para limpar a conta criada com outro id (o Auth não aceitou o id pedido). */
    async deleteAccount(id) {
      await call('DELETE', `/admin/users/${encodeURIComponent(id)}`);
    },
  };
}

/**
 * Cria a conta de um membro, idempotente. Devolve { outcome, info }:
 *   created    conta nova com o id pedido
 *   relinked   a conta já existia (outra execução ou nova tentativa), do mesmo membro
 *   failed     não criou; info = status e código do Auth (ou o motivo)
 * Rede, tempo-limite e 5xx são repetidos (até `retries` vezes), sempre conferindo antes
 * se a tentativa anterior chegou a criar a conta.
 */
export async function ensureAccount(admin, { id, email, legacyId }, { retries = 2, sleep = defaultSleep } = {}) {
  const same = (acc) => acc && acc.id === id && String(acc.email ?? '').toLowerCase() === email.toLowerCase()
    && String(acc.legacyId ?? '') === String(legacyId);
  for (let attempt = 0; ; attempt++) {
    try {
      const acc = await admin.createAccount({ id, email, legacyId });
      if (acc.id !== id) {
        // Risco 4 do E2.04: o Auth não aceitou o id. Não deixa a conta sobrando.
        if (acc.id) await admin.deleteAccount(acc.id).catch(() => {});
        return { outcome: 'failed', info: 'id_not_accepted' };
      }
      return { outcome: 'created' };
    } catch (err) {
      if (!(err instanceof AuthAdminError)) throw err;
      let existing;
      try {
        existing = await admin.getAccount(id);
      } catch (getErr) {
        if (!(getErr instanceof AuthAdminError)) throw getErr;
        existing = undefined;
      }
      if (existing && same(existing)) return { outcome: 'relinked' };
      if (existing) return { outcome: 'failed', info: 'other_owner' };
      const transient = err.status === 0 || err.status >= 500 || err.status === 429;
      // Sem conta e falha passageira, ou a conferência também falhou: tenta de novo.
      if (((existing === null && transient) || existing === undefined) && attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      return { outcome: 'failed', info: `http_${err.status}${err.authCode ? `_${err.authCode}` : ''}` };
    }
  }
}

const defaultSleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

/** Roda `fn` sobre `items` com até `limit` ao mesmo tempo; para de pegar itens novos se `shouldStop()`. */
export async function runPool(items, limit, fn, { shouldStop = () => false } = {}) {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length && !shouldStop()) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}
