// لوحة إدارة نَهج (nahj-iq.web.app/admin): كل عمليات المدير.
// الدخول بحساب Google عبر Firebase؛ الرمز في الترويسة x-admin-token، والبريد يجب أن يكون في ADMIN_EMAILS أو جدول admin_emails.
//   POST { action, ...args }
import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2.49.4';
import { HttpError, handler, json } from '../_shared/cors.ts';
import { fcmConfigured, sendFcm } from '../_shared/fcm.ts';
import { verifyFirebaseToken } from '../_shared/firebase-auth.ts';
import { admin } from '../_shared/supabase.ts';

type Args = Record<string, unknown>;
type Status = 'pending' | 'approved' | 'suspended' | 'rejected';
const STATUSES: Status[] = ['pending', 'approved', 'suspended', 'rejected'];
const FOREVER = '876000h';
/** الحساب محظور حالياً؟ (banned_until موجود في الاستجابة وإن لم يكن في نوع User) */
const isBanned = (u: User) => { const b = (u as User & { banned_until?: string | null }).banned_until; return !!b && Date.parse(b) > Date.now(); };

const envAdmins = () => (Deno.env.get('ADMIN_EMAILS') ?? '').split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);

async function adminList(db: SupabaseClient): Promise<{ email: string; primary: boolean; added_at?: string }[]> {
  const { data } = await db.from('admin_emails').select('email, added_at').order('added_at');
  const env = envAdmins();
  const out = env.map((email) => ({ email, primary: true }));
  for (const r of (data ?? []) as { email: string; added_at: string }[]) if (!env.includes(r.email)) out.push({ email: r.email, primary: false, added_at: r.added_at } as never);
  return out;
}

const str = (v: unknown, name: string, max = 500): string => {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${name} مطلوب`);
  if (v.length > max) throw new HttpError(400, `${name} طويل جداً`);
  return v.trim();
};
const uuidArg = (v: unknown): string => {
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) throw new HttpError(400, 'معرّف غير صالح');
  return v;
};
const emailArg = (v: unknown): string => {
  const e = str(v, 'البريد', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'البريد غير صحيح');
  return e;
};
const passwordArg = (v: unknown): string => {
  if (typeof v !== 'string' || v.length < 6) throw new HttpError(400, 'كلمة السر ٦ أحرف على الأقل');
  if (v.length > 72) throw new HttpError(400, 'كلمة السر طويلة جداً');
  return v;
};

async function allUsers(db: SupabaseClient): Promise<User[]> {
  const out: User[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

interface Stats { classes: number; sections: number; students: number; gradebooks: number; grades: number; attendance: number; plans: number; tasks: number; last_sync: string | null }
const ZERO: Stats = { classes: 0, sections: 0, students: 0, gradebooks: 0, grades: 0, attendance: 0, plans: 0, tasks: 0, last_sync: null };

async function statsMap(db: SupabaseClient, uid?: string): Promise<Map<string, Stats>> {
  const { data, error } = await db.rpc('admin_teacher_stats', { uid: uid ?? null });
  if (error) throw error;
  const m = new Map<string, Stats>();
  for (const r of (data ?? []) as (Stats & { owner_id: string })[]) {
    m.set(r.owner_id, {
      classes: Number(r.classes), sections: Number(r.sections), students: Number(r.students), gradebooks: Number(r.gradebooks),
      grades: Number(r.grades), attendance: Number(r.attendance), plans: Number(r.plans), tasks: Number(r.tasks), last_sync: r.last_sync,
    });
  }
  return m;
}

async function backupMap(db: SupabaseClient) {
  const { data } = await db.rpc('admin_backup_stats');
  const m = new Map<string, { files: number; bytes: number; last_at: string | null }>();
  for (const r of (data ?? []) as { owner_id: string; files: number; bytes: number; last_at: string }[]) m.set(r.owner_id, { files: Number(r.files), bytes: Number(r.bytes), last_at: r.last_at });
  return m;
}

type Profile = { name?: string; school?: string; subject?: string; gender?: string; phone?: string; city?: string };

async function teachers(db: SupabaseClient) {
  const [users, acc, settings, stats, backups, devices] = await Promise.all([
    allUsers(db),
    db.from('teacher_accounts').select('*'),
    db.from('teacher_settings').select('owner_id, profile, updated_at'),
    statsMap(db),
    backupMap(db),
    db.from('devices').select('owner_id, platform, app_version, updated_at'),
  ]);
  if (acc.error) throw acc.error;
  const accounts = new Map((acc.data ?? []).map((a) => [a.id as string, a]));
  const profiles = new Map((settings.data ?? []).map((s) => [s.owner_id as string, (s.profile ?? {}) as Profile]));
  const devs = new Map<string, { platform: string; app_version: string | null; updated_at: string }[]>();
  for (const d of (devices.data ?? []) as { owner_id: string; platform: string; app_version: string | null; updated_at: string }[]) {
    devs.set(d.owner_id, [...(devs.get(d.owner_id) ?? []), d]);
  }
  return users.map((u) => {
    const a = accounts.get(u.id);
    const p = profiles.get(u.id) ?? {};
    const d = devs.get(u.id) ?? [];
    const banned = isBanned(u);
    return {
      id: u.id,
      email: u.email ?? '',
      status: (a?.status ?? 'approved') as Status,
      note: a?.note ?? null,
      created_at: u.created_at,
      decided_at: a?.decided_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      provider: (u.app_metadata?.provider as string | undefined) ?? 'email',
      banned,
      name: p.name ?? '',
      school: p.school ?? '',
      subject: p.subject ?? '',
      gender: p.gender ?? '',
      stats: stats.get(u.id) ?? ZERO,
      backups: backups.get(u.id) ?? { files: 0, bytes: 0, last_at: null },
      devices: d.length,
      app_version: d.map((x) => x.app_version).filter(Boolean).sort().pop() ?? null,
    };
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

async function pushTo(db: SupabaseClient, ownerIds: string[] | null, title: string, body: string, route = '/') {
  if (!fcmConfigured()) return { sent: 0, note: 'FCM غير مضبوط' };
  let q = db.from('devices').select('token');
  if (ownerIds) {
    if (!ownerIds.length) return { sent: 0 };
    q = q.in('owner_id', ownerIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  const tokens = (data ?? []).map((d: { token: string }) => d.token);
  if (!tokens.length) return { sent: 0 };
  const dead = await sendFcm(tokens.map((token) => ({ token, title, body, data: { route }, channelId: 'news' })));
  if (dead.length) await db.from('devices').delete().in('token', dead);
  return { sent: tokens.length - dead.length };
}

async function setStatus(db: SupabaseClient, id: string, status: Status, note?: string) {
  const patch: Record<string, unknown> = { status, decided_at: new Date().toISOString() };
  if (typeof note === 'string') patch.note = note.slice(0, 1000);
  const { data: before } = await db.from('teacher_accounts').select('status').eq('id', id).maybeSingle();
  const { error } = await db.from('teacher_accounts').upsert({ id, ...patch }, { onConflict: 'id' });
  if (error) throw error;
  // الموقوف والمرفوض لا يستطيعان الدخول أصلاً؛ غيرهما يُرفع عنه الحظر
  const ban = status === 'suspended' || status === 'rejected';
  const { error: e2 } = await db.auth.admin.updateUserById(id, { ban_duration: ban ? FOREVER : 'none' });
  if (e2) throw e2;
  if (ban) await db.rpc('admin_revoke_sessions', { uid: id });
  if (status === 'approved' && before?.status !== 'approved') {
    await pushTo(db, [id], 'تمّت الموافقة على حسابك', 'بدأت مزامنة بياناتك مع السحابة. أهلاً بك في نَهج.').catch(() => null);
  }
}

async function removeBackups(db: SupabaseClient, id: string) {
  const bucket = db.storage.from('backups');
  for (let i = 0; i < 100; i++) {
    const { data, error } = await bucket.list(id, { limit: 100 });
    if (error || !data?.length) break;
    const { error: rm } = await bucket.remove(data.map((f) => `${id}/${f.name}`));
    if (rm) throw rm;
  }
}

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'POST فقط');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'nahj-iq';
  const token = req.headers.get('x-admin-token') ?? '';
  if (!token) throw new HttpError(401, 'سجّل الدخول أولاً');
  const me = await verifyFirebaseToken(token, projectId);
  const db = admin();
  const admins = await adminList(db);
  if (!admins.some((a) => a.email === me.email)) throw new HttpError(403, `الحساب ${me.email} ليس مديراً`);

  const args = (await req.json().catch(() => ({}))) as Args;
  const action = String(args.action ?? '');

  switch (action) {
    case 'me':
      return json({ email: me.email, name: me.name ?? null, picture: me.picture ?? null, primary: envAdmins().includes(me.email) });

    case 'overview': {
      const list = await teachers(db);
      const now = Date.now();
      const day = 86400000;
      const by = (s: Status) => list.filter((t) => t.status === s).length;
      const active7 = list.filter((t) => [t.last_sign_in_at, t.stats.last_sync].some((x) => x && now - Date.parse(x) < 7 * day)).length;
      const totals = list.reduce((s, t) => {
        for (const k of ['classes', 'sections', 'students', 'gradebooks', 'grades', 'attendance', 'plans'] as const) s[k] += t.stats[k];
        s.backup_bytes += t.backups.bytes;
        s.backup_files += t.backups.files;
        s.devices += t.devices;
        return s;
      }, { classes: 0, sections: 0, students: 0, gradebooks: 0, grades: 0, attendance: 0, plans: 0, backup_bytes: 0, backup_files: 0, devices: 0 });
      const signups: { day: string; n: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * day).toISOString().slice(0, 10);
        signups.push({ day: d, n: list.filter((t) => t.created_at.slice(0, 10) === d).length });
      }
      const { data: cfg } = await db.from('app_config').select('value').eq('key', 'require_approval').maybeSingle();
      return json({
        teachers: list.length, pending: by('pending'), approved: by('approved'), suspended: by('suspended'), rejected: by('rejected'),
        active7, totals, signups,
        recent: list.slice(0, 8).map(({ id, email, name, status, created_at }) => ({ id, email, name, status, created_at })),
        require_approval: cfg ? cfg.value === true : true,
        fcm: fcmConfigured(),
      });
    }

    case 'teachers':
      return json({ teachers: await teachers(db) });

    case 'teacher': {
      const id = uuidArg(args.id);
      const { data: u, error } = await db.auth.admin.getUserById(id);
      if (error || !u.user) throw new HttpError(404, 'الحساب غير موجود');
      const [acc, settings, stats, classes, sections, students, books, devices, files] = await Promise.all([
        db.from('teacher_accounts').select('*').eq('id', id).maybeSingle(),
        db.from('teacher_settings').select('profile, timetable, updated_at').eq('owner_id', id).maybeSingle(),
        statsMap(db, id),
        db.from('classes').select('id, name, subject, stage, sort').eq('owner_id', id).eq('deleted', false).order('sort'),
        db.from('sections').select('id, class_id, name, sort').eq('owner_id', id).eq('deleted', false).order('sort'),
        db.from('students').select('section_id').eq('owner_id', id).eq('deleted', false).limit(20000),
        db.from('gradebooks').select('section_id').eq('owner_id', id).eq('deleted', false).limit(5000),
        db.from('devices').select('platform, app_version, updated_at').eq('owner_id', id).order('updated_at', { ascending: false }),
        db.storage.from('backups').list(id, { limit: 100, sortBy: { column: 'name', order: 'desc' } }),
      ]);
      const perSection = new Map<string, number>();
      for (const s of (students.data ?? []) as { section_id: string }[]) perSection.set(s.section_id, (perSection.get(s.section_id) ?? 0) + 1);
      const booksPer = new Map<string, number>();
      for (const b of (books.data ?? []) as { section_id: string }[]) booksPer.set(b.section_id, (booksPer.get(b.section_id) ?? 0) + 1);
      const secs = (sections.data ?? []) as { id: string; class_id: string; name: string }[];
      const user = u.user;
      return json({
        id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null,
        provider: user.app_metadata?.provider ?? 'email',
        banned: isBanned(user),
        status: acc.data?.status ?? 'approved', note: acc.data?.note ?? null, decided_at: acc.data?.decided_at ?? null,
        profile: settings.data?.profile ?? null, settings_updated_at: settings.data?.updated_at ?? null,
        stats: stats.get(id) ?? ZERO,
        classes: ((classes.data ?? []) as { id: string; name: string; subject: string; stage: string }[]).map((c) => ({
          ...c,
          sections: secs.filter((s) => s.class_id === c.id).map((s) => ({ id: s.id, name: s.name, students: perSection.get(s.id) ?? 0, gradebooks: booksPer.get(s.id) ?? 0 })),
        })),
        devices: devices.data ?? [],
        backups: ((files.data ?? []) as { name: string; created_at: string; metadata: { size?: number } | null }[])
          .filter((f) => f.name.endsWith('.json'))
          .map((f) => ({ name: f.name, created_at: f.created_at, size: f.metadata?.size ?? 0 })),
      });
    }

    case 'set_status': {
      const id = uuidArg(args.id);
      const status = args.status as Status;
      if (!STATUSES.includes(status)) throw new HttpError(400, 'حالة غير صالحة');
      await setStatus(db, id, status, args.note as string | undefined);
      return json({ ok: true });
    }

    case 'approve_all': {
      const { data } = await db.from('teacher_accounts').select('id').eq('status', 'pending');
      for (const r of (data ?? []) as { id: string }[]) await setStatus(db, r.id, 'approved');
      return json({ ok: true, count: data?.length ?? 0 });
    }

    case 'note': {
      const id = uuidArg(args.id);
      const note = typeof args.note === 'string' ? args.note.slice(0, 1000) : null;
      const { error } = await db.from('teacher_accounts').update({ note }).eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    case 'set_password': {
      const id = uuidArg(args.id);
      const { error } = await db.auth.admin.updateUserById(id, { password: passwordArg(args.password) });
      if (error) throw error;
      if (args.signout !== false) await db.rpc('admin_revoke_sessions', { uid: id });
      return json({ ok: true });
    }

    case 'set_email': {
      const id = uuidArg(args.id);
      const { error } = await db.auth.admin.updateUserById(id, { email: emailArg(args.email), email_confirm: true });
      if (error) throw new HttpError(400, /already|exists|registered/i.test(error.message) ? 'هذا البريد مستعمل لحساب آخر' : error.message);
      return json({ ok: true });
    }

    case 'revoke': {
      await db.rpc('admin_revoke_sessions', { uid: uuidArg(args.id) });
      return json({ ok: true });
    }

    case 'delete': {
      const id = uuidArg(args.id);
      await removeBackups(db, id);
      const { error } = await db.auth.admin.deleteUser(id);
      if (error) throw error;
      return json({ ok: true });
    }

    case 'create': {
      // موافقة مسبقة: حساب بهذا البريد (بلا كلمة سر)؛ حين يدخل صاحبه بحساب Google بنفس البريد يُربط به ويجده مفعّلاً
      const email = emailArg(args.email);
      const password = typeof args.password === 'string' && args.password ? passwordArg(args.password) : undefined;
      const { data, error } = await db.auth.admin.createUser({ email, ...(password ? { password } : {}), email_confirm: true });
      if (error) throw new HttpError(400, /already|exists|registered/i.test(error.message) ? 'هذا البريد مسجّل مسبقاً' : error.message);
      await setStatus(db, data.user.id, 'approved');
      if (typeof args.name === 'string' && args.name.trim()) {
        await db.from('teacher_settings').upsert({ owner_id: data.user.id, profile: { name: args.name.trim().slice(0, 80) }, updated_at: '1970-01-01T00:00:00Z' });
      }
      return json({ ok: true, id: data.user.id });
    }

    case 'notify': {
      const title = str(args.title, 'العنوان', 120);
      const body = str(args.body, 'النص', 1000);
      let ids: string[] | null = null;
      if (args.id) ids = [uuidArg(args.id)];
      else {
        const { data } = await db.from('teacher_accounts').select('id').eq('status', 'approved');
        ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
      }
      return json({ ok: true, ...(await pushTo(db, ids, title, body)) });
    }

    case 'announcements': {
      const { data, error } = await db.from('announcements').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ announcements: data ?? [] });
    }

    case 'announce': {
      const title = str(args.title, 'العنوان', 120);
      const body = str(args.body, 'النص', 2000);
      const url = typeof args.url === 'string' && args.url.trim() ? args.url.trim().slice(0, 500) : null;
      const days = Number(args.days ?? 0);
      const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const { error } = await db.from('announcements').insert({ title, body, url, expires_at });
      if (error) throw error;
      let push = { sent: 0 } as { sent: number; note?: string };
      if (args.push) {
        const { data } = await db.from('teacher_accounts').select('id').eq('status', 'approved');
        push = await pushTo(db, ((data ?? []) as { id: string }[]).map((r) => r.id), title, body, url ?? '/');
      }
      return json({ ok: true, ...push });
    }

    case 'delete_announcement': {
      const { error } = await db.from('announcements').delete().eq('id', uuidArg(args.id));
      if (error) throw error;
      return json({ ok: true });
    }

    case 'config': {
      if (typeof args.require_approval === 'boolean') {
        const { error } = await db.from('app_config').upsert({ key: 'require_approval', value: args.require_approval, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      const { data } = await db.from('app_config').select('value').eq('key', 'require_approval').maybeSingle();
      return json({ require_approval: data ? data.value === true : true });
    }

    case 'admins':
      return json({ admins: await adminList(db) });

    case 'add_admin': {
      const email = emailArg(args.email);
      const { error } = await db.from('admin_emails').upsert({ email });
      if (error) throw error;
      // إن كان له حساب في التطبيق: يُفعّل
      const { data } = await db.from('teacher_accounts').select('id, status').eq('email', email).maybeSingle();
      if (data && data.status === 'pending') await setStatus(db, data.id as string, 'approved');
      return json({ admins: await adminList(db) });
    }

    case 'remove_admin': {
      const email = emailArg(args.email);
      if (envAdmins().includes(email)) throw new HttpError(400, 'المدير الرئيسي لا يُحذف من هنا');
      if (email === me.email) throw new HttpError(400, 'لا يمكنك حذف نفسك');
      await db.from('admin_emails').delete().eq('email', email);
      return json({ admins: await adminList(db) });
    }

    default:
      throw new HttpError(400, 'عملية غير معروفة');
  }
}));
