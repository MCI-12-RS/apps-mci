// QA E4 PR 2: adoção (DT-09), coincidências ambíguas e o que o cadastro do novo mantém.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, load, resetDest, fingerprint, integrity, q, pg, M, C, R, ADMINS } from './harness.mjs';

const OK = { drift: 0, periods: 0, member_rules: 0, cell_rules: 0, defaults: 1 };
const core = (extra = []) => ({
  members: [M(1, { Name: 'Pastor Um', Gender: 0 }), M(2, { LeadershipId: 1 }), M(3, { LeadershipId: 1 }), M(4, { LeadershipId: 2 }), ...extra],
  cells: [C(1, { LeadId: 2, TimothyId: 3, HostId: 4 })], reports: [], participants: [],
});
const ROLE = { def: '(SELECT id FROM public.roles WHERE is_default)', sys: '(SELECT id FROM public.roles WHERE is_system)', lid: `(SELECT id FROM public.roles WHERE name = 'Líder')` };
let n = 0;
async function newMember(o) {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const c = await pg();
  try {
    if (o.account) {
      await c.query(`INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
        VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1::text || '@mci12fakemail.com', now(), '{}', '{}', now(), now())`, [id]);
    }
    await c.query(`INSERT INTO public.members (id, name, email, mobile_whatsapp, cpf, gender, is_pastor, has_leadership, leader_id, spouse_id, role_id, auth_user_id, instagram)
      VALUES ($1, $2, $3, $4, $5, 'M', $6, $7, $8, $9, ${o.role ?? ROLE.def}, $10, $11)`,
    [id, o.name ?? `Novo Cadastro ${n}`, o.email ?? (o.mobile || o.cpf ? null : `nm${n}@exemplo.org`), o.mobile ?? null, o.cpf ?? null, !!o.pastor, !o.pastor && !!o.leader, o.leader ?? null, o.spouse ?? null,
      o.account ? id : null, o.instagram ?? null]);
    if (o.deleted) await c.query('UPDATE public.members SET deleted_at = now(), deleted_by_kind = \'unknown\' WHERE id = $1', [id]);
  } finally { await c.end(); }
  return id;
}
const mine = async (lid) => (await q('SELECT * FROM public.members WHERE legacy_id = $1', [lid]))[0];

beforeEach(() => resetDest());

describe('Adoção ambígua', () => {
  test('dois cadastros do novo coincidem com o mesmo membro do legado (um por e-mail, outro por CPF): para a carga, sem gravar', async () => {
    const d = core([M(10, { LeadershipId: 2, Email: 'amb10@exemplo.org', CPF: '529.982.247-25' })]);
    legacy(d);
    await newMember({ email: 'amb10@exemplo.org' });
    await newMember({ cpf: '52998224725' });
    const before = await fingerprint();
    const r = load(ADMINS);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /adoption_ambiguous[^\n]*10/);
    assert.deepEqual(await fingerprint(), before);
    const dry = load([...ADMINS, '--dry-run']);
    assert.notEqual(dry.status, 0, 'o --dry-run também para');
  });

  test('um cadastro do novo coincide com dois membros do legado (e-mail de um, celular de outro): para; os dois Ids são citados', async () => {
    const d = core([M(10, { LeadershipId: 2, Email: 'amb-a@exemplo.org' }), M(11, { LeadershipId: 2, MobileNumber: '51 99999-1111', Email: 'amb-b@exemplo.org' })]);
    legacy(d);
    await newMember({ email: 'amb-a@exemplo.org', mobile: '51999991111' });
    const r = load(ADMINS);
    assert.notEqual(r.status, 0);
    assert.match(r.out, /adoption_ambiguous/);
    assert.match(r.out, /10/); assert.match(r.out, /11/);
    assert.doesNotMatch(r.out, /amb-a@|99999-1111|Novo Cadastro/, 'sem dado pessoal');
  });

  test('cadastro do novo excluído, ou do legado excluído, nunca é adotado nem barra a carga', async () => {
    const d = core([M(10, { LeadershipId: 2, Email: 'ex-n@exemplo.org' }), M(11, { LeadershipId: 2, Email: 'ex-l@exemplo.org', IsDeleted: 1 })]);
    legacy(d);
    const del = await newMember({ email: 'ex-n@exemplo.org', deleted: true });
    const live = await newMember({ email: 'ex-l@exemplo.org' });
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const [a] = await q('SELECT legacy_id FROM public.members WHERE id = $1', [del]);
    const [b] = await q('SELECT legacy_id FROM public.members WHERE id = $1', [live]);
    assert.deepEqual([a.legacy_id, b.legacy_id], [null, null]);
    assert.deepEqual(await integrity(), OK);
  });

  test('9º dígito e máscara: celular do novo com outra forma é adotado; e-mail com maiúscula e espaço também', async () => {
    const d = core([M(10, { LeadershipId: 2, MobileNumber: '(51) 99999-0010' }), M(11, { LeadershipId: 2, Email: 'adota11@exemplo.org' }), M(12, { LeadershipId: 2, MobileNumber: '5199990012' })]);
    legacy(d);
    const a = await newMember({ mobile: '+55 51 9999-0010', name: 'Adotado Dez' });
    const b = await newMember({ email: ' ADOTA11@Exemplo.org ', name: 'Adotado Onze' });
    const c = await newMember({ mobile: '51 9 9999-0012', name: 'Adotado Doze' });
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    assert.equal((await mine(10)).id, a); assert.equal((await mine(11)).id, b); assert.equal((await mine(12)).id, c);
    assert.deepEqual(await integrity(), OK);
  });
});

describe('O que o adotado guarda e o que vem do legado', () => {
  test('adotado com conta e função: guarda id, conta, função e Instagram; liderança, cônjuge e demais dados vêm do legado; ex-líder e ex-cônjuge do novo ficam consistentes', async () => {
    const d = core([M(10, { LeadershipId: 3, Email: 'adota@exemplo.org', Name: 'Nome Do Legado', SpouseId: 11 }), M(11, { LeadershipId: 3, Gender: 1, SpouseId: 10 })]);
    legacy(d);
    const oldLeader = await newMember({ pastor: true, name: 'Antigo Lider' });
    const a = await newMember({ email: 'adota@exemplo.org', account: true, role: ROLE.sys, instagram: 'insta', leader: oldLeader, name: 'Nome Do Novo' });
    const oldSpouse = await newMember({ name: 'Antigo Conjuge', spouse: a, leader: oldLeader });
    const child = await newMember({ name: 'Discipulo Do Adotado', leader: a });
    assert.deepEqual(await integrity(), OK);
    const r = load(ADMINS);
    assert.equal(r.status, 0, r.out);
    const m = await mine(10);
    assert.equal(m.id, a); assert.equal(m.auth_user_id, a); assert.equal(m.instagram, 'insta'); assert.equal(m.name, 'Nome Do Legado');
    assert.equal((await q('SELECT name FROM public.roles WHERE id = $1', [m.role_id]))[0].name, 'Administrador');
    const m11 = await mine(11);
    assert.equal(m.spouse_id, m11.id);
    assert.equal((await q('SELECT spouse_id FROM public.members WHERE id = $1', [oldSpouse]))[0].spouse_id, null, 'o antigo cônjuge do adotado perde o vínculo');
    assert.equal((await q('SELECT leader_id FROM public.members WHERE id = $1', [child]))[0].leader_id, a, 'o discípulo do novo continua com o adotado');
    assert.equal((await q('SELECT leader_id FROM public.members WHERE id = $1', [a]))[0].leader_id, (await mine(3)).id, 'líder passa a ser o do legado');
    const [h] = await q(`SELECT count(*)::int AS n FROM private.member_hierarchy h WHERE h.member_id = $1 AND h.ancestor_ids @> ARRAY[$2::uuid]`, [child, (await mine(3)).id]);
    assert.equal(h.n, 1, 'a cadeia do discípulo do novo passa pelo novo líder do adotado');
    const [t] = await q('SELECT total_disciples AS d FROM private.member_hierarchy WHERE member_id = $1', [a]);
    assert.ok(t.d >= 1);
    assert.deepEqual(await integrity(), OK);
    // segunda carga: o adotado agora é "existing"; mudar o e-mail no novo não faz adotar de novo nem duplica
    await q('UPDATE public.members SET email = $2 WHERE id = $1', [a, 'outro-email@exemplo.org']);
    const r2 = load(ADMINS);
    assert.equal(r2.status, 0, r2.out);
    assert.equal((await q('SELECT count(*)::int AS n FROM public.members WHERE legacy_id = 10'))[0].n, 1);
    assert.equal((await mine(10)).email, 'adota@exemplo.org', 'o legado volta a mandar no e-mail');
    assert.equal((await mine(10)).role_id, m.role_id, 'a função do adotado nunca é mexida pela carga');
    const ad = await q('SELECT count(*)::int AS n FROM legacy._load_adopted WHERE legacy_id = 10');
    assert.equal(ad[0].n, 1);
  });

  test('adotado que o legado manda como pastor da D9 ou como Administrador respeita a lista; adotado com sem-liderança do legado deixa a flag coerente', async () => {
    const d = core([M(10, { Email: 'sl@exemplo.org', HasNoLeadership: 1, LeadershipId: 2 }), M(11, { Email: 'pastor@exemplo.org' })]);
    legacy(d);
    await newMember({ email: 'sl@exemplo.org', leader: undefined, pastor: true });
    await newMember({ email: 'pastor@exemplo.org', leader: undefined, pastor: false });
    const r = load(['--pastor-ids', '1', '--admin-ids', '1,11']);
    assert.equal(r.status, 0, r.out);
    const m = await mine(10);
    assert.deepEqual([m.is_pastor, m.has_leadership, m.leader_id], [false, false, null]);
    assert.deepEqual(await integrity(), OK);
  });
});
