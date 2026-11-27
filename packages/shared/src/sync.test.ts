import { describe, expect, it } from 'vitest';
import { SERVER_COLUMNS, toServerRow } from './sync';

const base = { id: 'x', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

describe('toServerRow', () => {
  it('without a table: keeps fields, drops undefined, adds owner', () => {
    expect(toServerRow({ ...base, a: 1, b: undefined }, 'u')).toEqual({ owner_id: 'u', ...base, a: 1 });
  });
  it('drops local-only fields the server does not know', () => {
    const r = toServerRow({ ...base, section_id: 's', name: 'أحمد', sort: 1, localOnly: true, _tmp: 3 }, 'u', 'students');
    expect(Object.keys(r).every((k) => k === 'owner_id' || SERVER_COLUMNS.students.includes(k))).toBe(true);
    expect(r.localOnly).toBeUndefined();
  });
  it('fixes values the server would reject', () => {
    const long = 'أ'.repeat(200);
    const r = toServerRow({ ...base, section_id: 's', name: `  ${long}  `, sort: 2.6, number: '7', gender: 'x' }, 'u', 'students');
    expect((r.name as string).length).toBe(160);
    expect(r.sort).toBe(3);
    expect(r.number).toBe(7);
    expect(r.gender).toBeNull();
    expect(toServerRow({ ...base, section_id: 's', name: '   ', sort: 0 }, 'u', 'students').name).toBe('—');
    expect(toServerRow({ ...base, class_id: 'c', name: 'أ'.repeat(50), sort: 0 }, 'u', 'sections').name).toHaveLength(40);
    expect(toServerRow({ ...base, gradebook_id: 'b', student_id: 's', column_id: 'c', value: 5, mark: 'weird' }, 'u', 'grades').mark).toBeNull();
    expect(toServerRow({ ...base, day: 9, period: -1 }, 'u', 'slots')).toMatchObject({ day: 6, period: 0 });
    expect(toServerRow({ ...base, title: 'ت', kind: 'task', done: null }, 'u', 'tasks').done).toBeUndefined();
  });
});
