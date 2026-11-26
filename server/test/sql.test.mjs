import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TABLES } from '../src/schema.mjs';
import { bindName, bindsFor, mergeSql, pullSql, rowFromDb, settingsMergeSql } from '../src/sql.mjs';

test('every table merges with last-write-wins and owner isolation', () => {
  for (const t of Object.keys(TABLES)) {
    const sql = mergeSql(t);
    assert.match(sql, /WHEN MATCHED THEN UPDATE/);
    assert.match(sql, /d\."owner_id" = s\."owner_id" AND s\."updated_at" >= d\."updated_at"/);
    assert.match(sql, /"synced_at" = SYSTIMESTAMP/);
    // كل ربط في SQL له قيمة في bindsFor
    const binds = bindsFor(t, { id: 'x' }, 'u1');
    for (const m of sql.matchAll(/:(\w+)/g)) assert.ok(m[1] in binds, `${t}: ${m[1]}`);
  }
});

test('reserved words are quoted (date, number, level…)', () => {
  assert.match(mergeSql('attendance'), /"date"/);
  assert.match(mergeSql('students'), /"number"/);
});

test('values are converted both ways (bool, json, timestamps, days)', () => {
  const b = bindsFor('gradebooks', { id: 'b1', title: 'سعي', columns: [{ id: 'c', kind: 'link' }], result: { pass: 50 }, archived: true, updated_at: '2026-11-26T10:00:00.000Z' }, 'u1');
  assert.equal(b[bindName('archived')], 1);
  assert.equal(b[bindName('columns')], '[{"id":"c","kind":"link"}]');
  assert.ok(b[bindName('updated_at')] instanceof Date);
  assert.equal(b[bindName('deleted')], 0);
  const row = rowFromDb('gradebooks', { id: 'b1', title: 'سعي', columns: '[{"id":"c"}]', archived: 1, deleted: 0, updated_at: new Date('2026-11-26T10:00:00Z'), synced_at: new Date('2026-11-26T10:00:01Z') });
  assert.deepEqual(row.columns, [{ id: 'c' }]);
  assert.equal(row.archived, true);
  assert.equal(row.deleted, false);
  assert.equal(row.updated_at, '2026-11-26T10:00:00.000Z');
  assert.equal(row.synced_at, '2026-11-26T10:00:01.000Z');
  assert.equal(bindsFor('attendance', { id: 'a', date: '2026-11-26' }, 'u')[bindName('date')], '2026-11-26');
});

test('pull is incremental and scoped to the owner', () => {
  assert.match(pullSql('grades'), /"owner_id" = :owner_id AND "synced_at" > :since ORDER BY "synced_at"/);
  assert.match(settingsMergeSql(), /MERGE INTO "teacher_settings"/);
});
