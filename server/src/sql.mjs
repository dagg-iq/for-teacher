/** بناء استعلامات Oracle وتحويل الصفوف (دوال خالصة، مختبرة في test/) */
import { COMMON, q, SETTINGS, TABLES } from './schema.mjs';

export const isTable = (t) => Object.prototype.hasOwnProperty.call(TABLES, t);

/** كل أعمدة جدول قابلة للكتابة من التطبيق (بلا owner_id و synced_at اللذين يضبطهما الخادم) */
export function columnsOf(t) {
  return { id: TABLES[t] ? 'id' : 'id', ...TABLES[t], ...COMMON };
}

/** قيمة من التطبيق ← قيمة ربط في Oracle */
export function toDb(type, v) {
  if (v === undefined || v === null) return null;
  switch (type) {
    case 'bool': return v ? 1 : 0;
    case 'json': return JSON.stringify(v);
    case 'ts': { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
    case 'int': return Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
    case 'num': return Number.isFinite(Number(v)) ? Number(v) : null;
    case 'day': return String(v).slice(0, 10);
    default: return String(v);
  }
}

/** قيمة من Oracle ← قيمة يفهمها التطبيق */
export function fromDb(type, v) {
  if (v === undefined || v === null) return null;
  switch (type) {
    case 'bool': return Number(v) === 1;
    case 'json': try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
    case 'ts': return v instanceof Date ? v.toISOString() : String(v);
    default: return v;
  }
}

/**
 * دمج «آخر تعديل يفوز»: يُدرج الصف الجديد، ويُحدَّث الموجود فقط إن كان التعديل القادم أحدث،
 * وفقط إن كان للمدرس نفسه (صف مدرس آخر بنفس المعرّف لا يُمس).
 */
export function mergeSql(t) {
  const cols = Object.keys(columnsOf(t));
  const src = cols.map((c) => `:${bindName(c)} AS ${q(c)}`).join(', ');
  const upd = cols.filter((c) => c !== 'id' && c !== 'created_at').map((c) => `d.${q(c)} = s.${q(c)}`).join(', ');
  return `MERGE INTO ${q(t)} d
USING (SELECT ${src}, :owner_id AS ${q('owner_id')} FROM dual) s
ON (d.${q('id')} = s.${q('id')})
WHEN MATCHED THEN UPDATE SET ${upd}, d.${q('synced_at')} = SYSTIMESTAMP
  WHERE d.${q('owner_id')} = s.${q('owner_id')} AND s.${q('updated_at')} >= d.${q('updated_at')}
WHEN NOT MATCHED THEN INSERT (${[...cols, 'owner_id', 'synced_at'].map(q).join(', ')})
  VALUES (${[...cols.map((c) => `s.${q(c)}`), `s.${q('owner_id')}`, 'SYSTIMESTAMP'].join(', ')})`;
}

/** أسماء الربط آمنة (بعضها كلمات محجوزة) */
export const bindName = (c) => `b_${c}`;

export function bindsFor(t, row, ownerId) {
  const types = columnsOf(t);
  const out = { owner_id: ownerId };
  for (const [c, ty] of Object.entries(types)) out[bindName(c)] = toDb(ty, row[c]);
  if (!out[bindName('created_at')]) out[bindName('created_at')] = new Date();
  if (!out[bindName('updated_at')]) out[bindName('updated_at')] = new Date();
  if (out[bindName('deleted')] == null) out[bindName('deleted')] = 0;
  return out;
}

export function pullSql(t) {
  return `SELECT * FROM ${q(t)} WHERE ${q('owner_id')} = :owner_id AND ${q('synced_at')} > :since ORDER BY ${q('synced_at')} FETCH FIRST :lim ROWS ONLY`;
}

/** صف من Oracle ← سجل التطبيق (+ synced_at كمؤشر للسحب التالي) */
export function rowFromDb(t, r) {
  const types = columnsOf(t);
  const out = {};
  for (const [c, ty] of Object.entries(types)) if (c in r) out[c] = fromDb(ty, r[c]);
  out.synced_at = fromDb('ts', r.synced_at);
  return out;
}

export function settingsMergeSql() {
  const cols = Object.keys(SETTINGS);
  return `MERGE INTO ${q('teacher_settings')} d
USING (SELECT :owner_id AS ${q('owner_id')}, ${cols.map((c) => `:${bindName(c)} AS ${q(c)}`).join(', ')}, :${bindName('updated_at')} AS ${q('updated_at')} FROM dual) s
ON (d.${q('owner_id')} = s.${q('owner_id')})
WHEN MATCHED THEN UPDATE SET ${cols.map((c) => `d.${q(c)} = s.${q(c)}`).join(', ')}, d.${q('updated_at')} = s.${q('updated_at')}, d.${q('synced_at')} = SYSTIMESTAMP
  WHERE s.${q('updated_at')} >= d.${q('updated_at')}
WHEN NOT MATCHED THEN INSERT (${[q('owner_id'), ...cols.map(q), q('updated_at'), q('synced_at')].join(', ')})
  VALUES (s.${q('owner_id')}, ${cols.map((c) => `s.${q(c)}`).join(', ')}, s.${q('updated_at')}, SYSTIMESTAMP)`;
}

export function settingsBinds(body, ownerId) {
  const out = { owner_id: ownerId, [bindName('updated_at')]: toDb('ts', body.updated_at) ?? new Date() };
  for (const c of Object.keys(SETTINGS)) out[bindName(c)] = toDb('json', body[c]);
  return out;
}

export function settingsFromDb(r) {
  if (!r) return null;
  const out = { updated_at: fromDb('ts', r.updated_at) };
  for (const c of Object.keys(SETTINGS)) out[c] = fromDb('json', r[c]);
  return out;
}
