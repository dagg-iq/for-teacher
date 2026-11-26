/** يولّد مخطط Oracle لنَهج: node src/ddl.mjs > sql/schema.sql */
import { COMMON, q, SETTINGS, TABLES, TEXT_IDS } from './schema.mjs';

const TYPE = {
  id: 'VARCHAR2(36)',
  key: 'VARCHAR2(120)',
  text: 'NVARCHAR2(500)',
  long: 'NCLOB',
  int: 'NUMBER(10)',
  num: 'BINARY_DOUBLE',
  bool: 'NUMBER(1) DEFAULT 0 NOT NULL',
  json: 'CLOB',
  ts: 'TIMESTAMP(6) WITH TIME ZONE',
  day: 'VARCHAR2(10)',
};

const out = [];
out.push(`-- مخطط نَهج لقاعدة Oracle (19c فأحدث، ومنها Autonomous Database).
-- مولَّد من server/src/schema.mjs — لا تعدّله يدوياً: عدّل المصدر ثم «npm run ddl».
-- كل صف يتبع مدرساً (owner_id = هوية الحساب من رمز الدخول)، و synced_at يضبطه الخادم للسحب التزايدي.
`);
for (const [t, cols] of Object.entries(TABLES)) {
  const lines = [
    `  ${q('id')} ${TEXT_IDS.has(t) ? 'VARCHAR2(200)' : 'VARCHAR2(36)'} PRIMARY KEY`,
    `  ${q('owner_id')} VARCHAR2(64) NOT NULL`,
    ...Object.entries(cols).map(([c, ty]) => `  ${q(c)} ${TYPE[ty]}${ty === 'json' ? ` CHECK (${q(c)} IS JSON)` : ''}`),
    `  ${q('created_at')} ${TYPE.ts} DEFAULT SYSTIMESTAMP NOT NULL`,
    `  ${q('updated_at')} ${TYPE.ts} DEFAULT SYSTIMESTAMP NOT NULL`,
    `  ${q('deleted')} ${TYPE.bool}`,
    `  ${q('synced_at')} ${TYPE.ts} DEFAULT SYSTIMESTAMP NOT NULL`,
  ];
  out.push(`CREATE TABLE ${q(t)} (\n${lines.join(',\n')}\n);`);
  out.push(`CREATE INDEX ${q(`${t}_owner_synced`)} ON ${q(t)} (${q('owner_id')}, ${q('synced_at')});\n`);
}
out.push(`CREATE TABLE ${q('teacher_settings')} (
  ${q('owner_id')} VARCHAR2(64) PRIMARY KEY,
${Object.keys(SETTINGS).map((c) => `  ${q(c)} CLOB CHECK (${q(c)} IS JSON)`).join(',\n')},
  ${q('updated_at')} ${TYPE.ts} DEFAULT SYSTIMESTAMP NOT NULL,
  ${q('synced_at')} ${TYPE.ts} DEFAULT SYSTIMESTAMP NOT NULL
);`);
void COMMON;
process.stdout.write(`${out.join('\n')}\n`);
