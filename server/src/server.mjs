/**
 * خادم مزامنة نَهج مع Oracle — نفس عقد المزامنة الذي يستعمله التطبيق (EXPO_PUBLIC_SYNC_BACKEND=rest):
 *   GET  /v1/health
 *   POST /v1/sync/push      { table, rows: [...] }          ← دمج «آخر تعديل يفوز»
 *   GET  /v1/sync/pull?table=&since=&limit=                  ← الصفوف المتغيرة بعد since (مرتبة بـ synced_at)
 *   GET  /v1/settings  ·  PUT /v1/settings  { profile, timetable, prefs, updated_at }
 *   POST /v1/account/delete                                  ← حذف كل بيانات المدرس
 * الإعداد بالمتغيرات: ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING (و ORACLE_WALLET_DIR/ORACLE_WALLET_PASSWORD
 * لـ Autonomous Database)، JWKS_URL أو JWT_SECRET، PORT، CORS_ORIGIN.
 */
import http from 'node:http';
import oracledb from 'oracledb';
import { userFrom } from './auth.mjs';
import { ORDER } from './schema.mjs';
import { bindsFor, isTable, mergeSql, pullSql, rowFromDb, settingsBinds, settingsFromDb, settingsMergeSql } from './sql.mjs';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchAsString = [oracledb.CLOB, oracledb.NCLOB];

const pool = await oracledb.createPool({
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
  ...(process.env.ORACLE_WALLET_DIR ? { configDir: process.env.ORACLE_WALLET_DIR, walletLocation: process.env.ORACLE_WALLET_DIR, walletPassword: process.env.ORACLE_WALLET_PASSWORD } : {}),
  poolMin: 1, poolMax: Number(process.env.ORACLE_POOL_MAX || 8),
});

const CORS = process.env.CORS_ORIGIN || '*';
const MAX_BODY = 5 * 1024 * 1024;

function send(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': CORS, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error('الطلب كبير جداً'), { code: 413 }); chunks.push(c); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

async function withConn(fn) {
  const conn = await pool.getConnection();
  try { return await fn(conn); } finally { await conn.close(); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (url.pathname === '/v1/health') return send(res, 200, await withConn(async (c) => { await c.execute('SELECT 1 FROM dual'); return { ok: true }; }));
    const uid = await userFrom(req).catch(() => null);
    if (!uid) return send(res, 401, { error: 'سجّل الدخول أولاً' });

    if (url.pathname === '/v1/sync/push' && req.method === 'POST') {
      const { table, rows } = await readJson(req);
      if (!isTable(table) || !Array.isArray(rows)) return send(res, 400, { error: 'جدول غير معروف' });
      if (rows.length > 1000) return send(res, 413, { error: 'دفعة كبيرة' });
      await withConn(async (c) => {
        if (rows.length) await c.executeMany(mergeSql(table), rows.map((r) => bindsFor(table, r, uid)), { autoCommit: false });
        await c.commit();
      });
      return send(res, 200, { ok: true, count: rows.length });
    }

    if (url.pathname === '/v1/sync/pull' && req.method === 'GET') {
      const table = url.searchParams.get('table');
      if (!isTable(table)) return send(res, 400, { error: 'جدول غير معروف' });
      const since = new Date(url.searchParams.get('since') || 0);
      const lim = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 1000)));
      const rows = await withConn(async (c) => (await c.execute(pullSql(table), { owner_id: uid, since, lim })).rows ?? []);
      return send(res, 200, { rows: rows.map((r) => rowFromDb(table, r)) });
    }

    if (url.pathname === '/v1/settings') {
      if (req.method === 'GET') {
        const row = await withConn(async (c) => (await c.execute('SELECT * FROM "teacher_settings" WHERE "owner_id" = :o', { o: uid })).rows?.[0]);
        return send(res, 200, { settings: settingsFromDb(row) });
      }
      if (req.method === 'PUT') {
        const body = await readJson(req);
        await withConn(async (c) => { await c.execute(settingsMergeSql(), settingsBinds(body, uid), { autoCommit: true }); });
        return send(res, 200, { ok: true });
      }
    }

    if (url.pathname === '/v1/account/delete' && req.method === 'POST') {
      await withConn(async (c) => {
        for (const t of [...ORDER].reverse()) await c.execute(`DELETE FROM "${t}" WHERE "owner_id" = :o`, { o: uid });
        await c.execute('DELETE FROM "teacher_settings" WHERE "owner_id" = :o', { o: uid });
        await c.commit();
      });
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'غير موجود' });
  } catch (e) {
    console.error(e);
    return send(res, e.code === 413 ? 413 : 500, { error: e.code === 413 ? e.message : 'خطأ في الخادم' });
  }
});

server.listen(Number(process.env.PORT || 8080), () => console.log(`nahj sync api on :${process.env.PORT || 8080}`));
