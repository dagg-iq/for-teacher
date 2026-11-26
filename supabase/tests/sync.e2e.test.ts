/**
 * اختبار المزامنة الحقيقي على Supabase محلي (supabase start) — يعمل في CI.
 * يرفع سجلات بنفس شكل التطبيق (بحقول اختيارية ناقصة) ثم يسحبها ويتحقق منها، ويتحقق من عزل المستخدمين.
 *   SUPABASE_TEST_URL=... SUPABASE_TEST_ANON=... SUPABASE_TEST_SERVICE=... npx vitest run --root supabase/tests
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { fromServerRow, gradeId, SYNC_TABLES, TEMPLATES, toServerRow, uuid } from '../../packages/shared/src';

const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON;
const SERVICE = process.env.SUPABASE_TEST_SERVICE;
const run = URL && ANON && SERVICE ? describe : describe.skip;

async function user(email: string) {
  const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({ email, password: 'secret-123456', email_confirm: true });
  if (error && !/already/.test(error.message)) throw error;
  const c = createClient(URL!, ANON!, { auth: { persistSession: false } });
  const { data, error: e2 } = await c.auth.signInWithPassword({ email, password: 'secret-123456' });
  if (e2) throw e2;
  // الحسابات الجديدة بانتظار موافقة المدير
  const { error: e3 } = await admin.from('teacher_accounts').update({ status: 'approved' }).eq('id', data.user!.id);
  if (e3) throw e3;
  return { c, id: data.user!.id };
}

const now = () => new Date().toISOString();

run('sync against real Supabase', () => {
  it('push rows with missing optional fields, pull them back, isolate users', async () => {
    const a = await user(`a${Date.now()}@nahj.test`);
    const b = await user(`b${Date.now()}@nahj.test`);
    const t = now();
    const base = { created_at: t, updated_at: t, deleted: false };
    const tpl = TEMPLATES[0].build();
    const cls = { id: uuid(), name: 'الخامس العلمي', stage: 'preparatory', subject: 'الفيزياء', hue: 0, sort: 0, ...base };
    const sec = { id: uuid(), class_id: cls.id, name: 'أ', sort: 0, ...base };
    const st = { id: uuid(), section_id: sec.id, name: 'أحمد علي', sort: 0, ...base };
    const book = { id: uuid(), section_id: sec.id, title: 'سجل', template: 'saey', columns: tpl.columns, result: tpl.result, ...base };
    const rows: Record<string, object[]> = {
      classes: [cls],
      sections: [sec, { id: uuid(), class_id: cls.id, name: 'ب', room: 'القاعة ٣', sort: 1, ...base }],
      students: [st, { id: uuid(), section_id: sec.id, name: 'علي حسن', number: 2, parent_phone: '07701234567', sort: 1, ...base }],
      gradebooks: [book, { ...book, id: uuid(), archived: true, pinned: true }],
      grades: [
        { id: gradeId(book.id, st.id, tpl.columns[0].id), gradebook_id: book.id, student_id: st.id, column_id: tpl.columns[0].id, value: 85.5, ...base },
        { id: gradeId(book.id, st.id, tpl.columns[1].id), gradebook_id: book.id, student_id: st.id, column_id: tpl.columns[1].id, value: null, mark: 'absent', ...base },
      ],
      attendance: [{ id: `${sec.id}|2026-11-18|${st.id}`, section_id: sec.id, student_id: st.id, date: '2026-11-18', status: 'absent', ...base }],
      slots: [{ id: uuid(), day: 0, period: 1, section_id: sec.id, ...base }, { id: uuid(), day: 1, period: 0, label: 'إشراف', ...base }],
      tasks: [{ id: uuid(), title: 'امتحان', kind: 'exam', due: t, remind: 60, ...base }],
      lesson_plans: [{ id: uuid(), date: '2026-11-18', title: 'درس', section_ids: [sec.id], ...base }],
      student_notes: [{ id: uuid(), student_id: st.id, kind: 'positive', text: 'ممتاز', date: '2026-11-18', ...base }],
    };
    for (const table of SYNC_TABLES) {
      const { error } = await a.c.from(table).upsert(rows[table].map((r) => toServerRow(r, a.id)), { onConflict: 'id', defaultToNull: false });
      expect(error, `${table}: ${error?.message}`).toBeNull();
    }
    const { error: sErr } = await a.c.from('teacher_settings').upsert({ owner_id: a.id, profile: { name: 'أ' }, timetable: null, prefs: {}, updated_at: t });
    expect(sErr).toBeNull();

    // السحب
    for (const table of SYNC_TABLES) {
      const { data, error } = await a.c.from(table).select('*').gt('synced_at', '1970-01-01').order('synced_at');
      expect(error).toBeNull();
      const got = (data ?? []).map((r) => fromServerRow<{ id: string }>(r));
      expect(got.map((r) => r.id).sort()).toEqual(rows[table].map((r) => (r as { id: string }).id).sort());
    }
    const { data: g } = await a.c.from('grades').select('*');
    expect(g!.find((x) => x.value === 85.5)).toBeTruthy();
    expect(g!.find((x) => x.mark === 'absent')).toBeTruthy();
    const { data: gb } = await a.c.from('gradebooks').select('*').eq('id', book.id).single();
    expect(gb!.archived).toBe(false);
    expect(gb!.columns).toHaveLength(tpl.columns.length);

    // آخر تعديل + حذف ناعم
    const later = new Date(Date.now() + 1000).toISOString();
    const { error: uErr } = await a.c.from('students').upsert(toServerRow({ ...st, name: 'أحمد علي حسين', updated_at: later, deleted: true }, a.id), { onConflict: 'id', defaultToNull: false });
    expect(uErr).toBeNull();
    const { data: s2 } = await a.c.from('students').select('*').eq('id', st.id).single();
    expect(s2!.name).toBe('أحمد علي حسين');
    expect(s2!.deleted).toBe(true);

    // العزل
    const { data: other } = await b.c.from('classes').select('*');
    expect(other).toHaveLength(0);
    const { error: steal } = await b.c.from('classes').upsert(toServerRow({ ...cls, name: 'اختراق' }, b.id), { onConflict: 'id', defaultToNull: false });
    expect(steal).not.toBeNull();

    // حذف البيانات
    const { error: dErr } = await a.c.rpc('delete_my_data');
    expect(dErr).toBeNull();
    const { data: none } = await a.c.from('grades').select('id');
    expect(none).toHaveLength(0);
  }, 60000);
});

run('approval gate', () => {
  it('a new account is pending and cannot sync until approved', async () => {
    const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const email = `p${Date.now()}@nahj.test`;
    const { error } = await admin.auth.admin.createUser({ email, password: 'secret-123456', email_confirm: true });
    if (error) throw error;
    const c = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { data } = await c.auth.signInWithPassword({ email, password: 'secret-123456' });
    const id = data.user!.id;
    const me = await c.from('teacher_accounts').select('status').maybeSingle();
    expect(me.data?.status).toBe('pending');
    const t = now();
    const row = { id: uuid(), name: 'صف', stage: 'other', subject: '', hue: 0, sort: 0, created_at: t, updated_at: t, deleted: false, owner_id: id };
    const blocked = await c.from('classes').upsert([row], { onConflict: 'id', defaultToNull: false });
    expect(blocked.error).toBeTruthy();
    await admin.from('teacher_accounts').update({ status: 'approved' }).eq('id', id);
    const ok = await c.from('classes').upsert([row], { onConflict: 'id', defaultToNull: false });
    expect(ok.error).toBeNull();
  });
});
