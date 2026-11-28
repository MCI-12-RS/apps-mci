// Massa fictícia e ajudantes do QA da reconciliação (E4 PR 5, npm run reconcile).
// Carga + contas na stack local da pista B; cada caso injeta UMA divergência no destino já
// reconciliado limpo (como postgres, em replica quando preciso), roda a reconciliação e desfaz.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { legacy, load, resetDest, q, pg, M, C, R, ADMINS, ROOT, CONFIG } from './harness.mjs';

export { q, pg, M, C, R, ADMINS, ROOT, CONFIG };
export const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const LANE = process.env.QA_LANE_DIR ?? '/home/user/apps-mci/.worktrees/mci-connect-b';
export const AT = '2026-11-14 23:00'; // sábado à noite; semana de 08/11 (domingo) a 14/11
export const API = `http://127.0.0.1:${process.env.QA_API_PORT ?? 58321}`;

export const world = () => ({
  addresses: [{ Id: 1, Street: 'Rua Fictícia', Number: '10', Neighborhood: 'Centro', City: 'Porto Alegre', State: 'RS', PostalCode: '90000-000' },
    { Id: 2, Street: 'Rua Outra', Number: '20', Neighborhood: 'Bairro B', City: 'Canoas', State: 'RS', PostalCode: '92000-000' }],
  members: [
    M(1, { MinistryLevel: 1, Name: 'Pastor Um', Gender: 0, Password: md5('s1') }),
    M(2, { MinistryLevel: 12, Name: 'Gedoze Dois', Gender: 0, LeadershipId: 1, Password: md5('s2') }),
    M(3, { MinistryLevel: 144, Name: 'Tres Discipula', Gender: 1, LeadershipId: 2, Password: md5('s3'), HomeAddressId: 1 }),
    M(4, { MinistryLevel: 144, Name: 'Quatro Discipulo', Gender: 0, LeadershipId: 2, Password: md5('s4') }),
    M(5, { MinistryLevel: 1728, Name: 'Cinco Neta', Gender: 1, LeadershipId: 3, Password: md5('s5') }),
    M(6, { MinistryLevel: 1728, Name: 'Seis Neto', Gender: 0, LeadershipId: 4, Password: md5('s6') }),
    M(7, { MinistryLevel: 1728, Name: 'Sete Neta', Gender: 1, LeadershipId: 4, Password: md5('s7') }),
    M(8, { MinistryLevel: 144, Name: 'Oito Excluido', Gender: 0, LeadershipId: 2, IsDeleted: 1, Password: md5('s8') }),
    M(9, { MinistryLevel: 1728, Name: 'Nove Inativa', Gender: 1, LeadershipId: 3, Idle: 1, Password: md5('s9') }),
    M(10, { MinistryLevel: 144, Name: 'Dez Marido', Gender: 0, LeadershipId: 2, SpouseId: 11, Password: md5('s10'), Baptized: 1, BaptismDate: '2020-01-01 00:00:00' }),
    M(11, { MinistryLevel: 1728, Name: 'Onze Esposa', Gender: 1, LeadershipId: 3, SpouseId: 10, Password: md5('s11') }),
    M(12, { MinistryLevel: 12, Name: 'Doze Gedoze', Gender: 0, LeadershipId: 1, Password: md5('s12') }),
    M(13, { MinistryLevel: 144, Name: 'Treze Filha', Gender: 1, LeadershipId: 12, Password: md5('s13') }),
    M(14, { MinistryLevel: 144, Name: 'Catorze Cpfruim', Gender: 0, LeadershipId: 2, CPF: '111.111.111-11', Password: md5('s14') }),
    M(15, { MinistryLevel: 144, Name: 'Quinze Cpfbom', Gender: 1, LeadershipId: 2, CPF: '529.982.247-25', Password: md5('s15') }),
    M(16, { MinistryLevel: 144, Name: 'Dezesseis Repetido', Gender: 0, LeadershipId: 2, Email: 'repetido@exemplo.org', MobileNumber: '51 99999-0016', Password: md5('s16') }),
    M(17, { MinistryLevel: 144, Name: 'Dezessete Repetido', Gender: 1, LeadershipId: 2, Email: 'REPETIDO@exemplo.org', MobileNumber: '51 99999-0017', Password: md5('s17') }),
  ],
  cells: [
    C(1, { LeadId: 2, TimothyId: 3, HostId: 4, WeekDay: 3, Time: '20:00', CellType: 0, PlaceId: 1 }),
    C(2, { LeadId: 3, TimothyId: 5, HostId: 5, WeekDay: 1, Time: '19:30', CellType: 1, PlaceId: 2 }),
    C(3, { LeadId: 4, TimothyId: 6, HostId: 7, WeekDay: 5, Time: '09:00', CellType: 2 }),
    C(4, { LeadId: 12, TimothyId: 13, HostId: 13, WeekDay: 6, Time: '18:00', CellType: 0 }),
    C(5, { LeadId: 2, TimothyId: 3, HostId: 4, WeekDay: 2, Time: '10:00', CellType: 0, IsDeleted: 1 }),
  ],
  reports: [
    R(1, { CellId: 1, Date: '2026-11-04 20:00:00', Subject: 'Fe', Contribution: 123.45, Visitors: 'Ana|Bia', NumMembers: 3, NumVisitors: 2, LeadershipId: 2, TimothyId: 3, HostId: 4, CellType: 0 }),
    R(2, { CellId: 1, Date: '2026-11-11 20:30:00', Subject: 'Amor', Contribution: 50.10, NumMembers: 4, NumVisitors: 0, LeadershipId: 2, TimothyId: 3, HostId: 4, CellType: 0 }),
    R(3, { CellId: 2, Date: '2026-11-09 19:30:00', Subject: null, Notes: 'Chuva forte', WeekCellSkipped: 1, Contribution: 0, NumMembers: 0, LeadershipId: 3, TimothyId: 5, HostId: 5, CellType: 1 }),
    R(4, { CellId: 3, Date: '2026-11-06 09:00:00', Subject: 'Graca', Contribution: 10.07, NumMembers: 3, LeadershipId: 4, TimothyId: 6, HostId: 7, CellType: 2 }),
    R(5, { CellId: 4, Date: '2026-11-07 18:00:00', Subject: 'Paz', Contribution: 7.30, Visitors: 'Caio', NumMembers: 2, NumVisitors: 1, LeadershipId: 12, TimothyId: 13, HostId: 13, CellType: 0 }),
    R(6, { CellId: 1, Date: '2026-10-28 20:00:00', Subject: 'Antigo', Contribution: 5.55, NumMembers: 2, LeadershipId: 2, TimothyId: 3, HostId: 4, CellType: 0, IsDeleted: 1 }),
  ],
  // [MemberId, ReportId]; os de cada relatório batem com NumMembers
  participants: [[2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2], [5, 2], [4, 4], [6, 4], [7, 4], [12, 5], [13, 5], [2, 6], [3, 6]],
});

let secret;
export function statusEnv() {
  const txt = execFileSync('supabase', ['status', '-o', 'env'], { cwd: LANE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const get = (k) => new RegExp(`^${k}="(.*)"$`, 'm').exec(txt)?.[1];
  return { secret: get('SECRET_KEY'), pub: get('PUBLISHABLE_KEY') };
}

export class Env {
  constructor() {
    this.work = mkdtempSync(join(tmpdir(), 'qa-rc-'));
    this.out = join(this.work, 'reports');
    ({ secret } = statusEnv());
    this.cfg = join(this.work, 'rc.config');
    writeFileSync(this.cfg, `${readFileSync(CONFIG, 'utf8')}\nSUPABASE_URL="${API}"\nSUPABASE_SECRET_KEY="${secret}"\n`, { mode: 0o600 });
    this.outputs = [];
  }
  cleanup() { rmSync(this.work, { recursive: true, force: true }); }
  async wipe() {
    resetDest();
    await q('DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users)');
    await q('DELETE FROM public.events').catch(() => {});
  }
  accounts() {
    const r = spawnSync('node', ['--no-deprecation', resolve(ROOT, 'src/accounts.mjs'), '--config', this.cfg, '--out-dir', join(this.work, 'acc')],
      { encoding: 'utf8', timeout: 240000 });
    if (r.status !== 0) throw new Error(`accounts falhou:\n${r.stdout}${r.stderr}`);
  }
  async setup(w = world(), { accounts = true } = {}) {
    await this.wipe();
    legacy(w);
    const r = load(ADMINS);
    if (r.status !== 0) throw new Error(`load falhou:\n${r.out}`);
    if (accounts) this.accounts();
  }
  /** Roda a reconciliação; devolve { status, out, json, md }. */
  recon(args = [], { dry = false, env = {} } = {}) {
    const a = ['--no-deprecation', resolve(ROOT, 'src/reconcile.mjs'), '--config', this.cfg, '--out-dir', this.out,
      '--at', AT, '--credential-sample', '500', ...(dry ? ['--dry-run'] : []), ...args];
    const before = new Set(this.files());
    const r = spawnSync('node', a, { encoding: 'utf8', timeout: 300000, env: { ...process.env, ...env } });
    const out = `${r.stdout}${r.stderr}`;
    this.outputs.push(out);
    const fresh = this.files().filter((f) => !before.has(f));
    const jf = fresh.find((f) => f.endsWith('.json'));
    const mf = fresh.find((f) => f.endsWith('.md'));
    const json = jf ? JSON.parse(readFileSync(join(this.out, jf), 'utf8')) : null;
    const md = mf ? readFileSync(join(this.out, mf), 'utf8') : null;
    if (json) this.outputs.push(JSON.stringify(json), md);
    return { status: r.status, out, json, md };
  }
  files() { try { return readdirSync(this.out); } catch { return []; } }
}

/** Resumo de um relatório JSON: códigos com inesperadas e pares esperados. */
export function view(json) {
  const by = Object.fromEntries(json.checks.map((c) => [c.code, c]));
  const unexpected = (code) => (by[code]?.unexpected ?? []).map(([lid, ref, detail, note]) => ({ lid, ref, detail, note }));
  const expected = (code) => (by[code]?.expected ?? []).map(([lid, ref, reason]) => `${lid}:${reason}`);
  const failed = json.checks.filter((c) => c.status === 'falha').map((c) => c.code);
  return { by, unexpected, expected, failed };
}

/** Executa SQL como postgres; replica = triggers desligados (como a carga). */
export async function sql(text, { replica = true, params } = {}) {
  const c = await pg();
  try {
    await c.query('BEGIN');
    if (replica) await c.query('SET LOCAL session_replication_role = replica');
    const r = await c.query(text, params);
    await c.query('COMMIT');
    return r.rows;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { await c.end(); }
}
