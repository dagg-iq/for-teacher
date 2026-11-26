/**
 * جداول نَهج كما في التطبيق (packages/shared/src/types.ts) ومخطط Supabase (supabase/migrations).
 * المصدر الوحيد لمخطط Oracle (src/ddl.mjs) ولتحويل الصفوف في الخادم.
 * الأنواع: id (VARCHAR2 36) · key (معرّف نصي طويل) · text · long (نص طويل) · int · num · bool · json · ts (وقت) · day (YYYY-MM-DD)
 */
export const TABLES = {
  classes: { name: 'text', stage: 'text', subject: 'text', hue: 'int', sort: 'int' },
  sections: { class_id: 'id', name: 'text', room: 'text', sort: 'int' },
  students: { section_id: 'id', name: 'text', number: 'int', parent_phone: 'text', notes: 'long', gender: 'text', sort: 'int' },
  gradebooks: {
    section_id: 'id', title: 'text', template: 'text', columns: 'json', result: 'json', year: 'text', note: 'long',
    archived: 'bool', pinned: 'bool', group_id: 'id', role: 'text', ord: 'int',
  },
  grades: { gradebook_id: 'id', student_id: 'id', column_id: 'key', value: 'num', mark: 'text' },
  attendance: { section_id: 'id', student_id: 'id', date: 'day', status: 'text', note: 'long' },
  slots: { day: 'int', period: 'int', section_id: 'id', label: 'text', room: 'text' },
  tasks: { title: 'text', note: 'long', kind: 'text', due: 'ts', remind: 'int', done: 'bool', section_id: 'id' },
  lesson_plans: {
    date: 'day', class_id: 'id', section_ids: 'json', title: 'text', objectives: 'long', materials: 'long', method: 'long',
    steps: 'long', evaluation: 'long', homework: 'long', done: 'bool',
  },
  student_notes: { student_id: 'id', kind: 'text', text: 'long', date: 'day' },
};

/** معرّفات نصية طويلة (الدرجة: سجل|طالب|عمود، والحضور: شعبة|يوم|طالب) */
export const TEXT_IDS = new Set(['grades', 'attendance']);

/** ترتيب المزامنة (الآباء قبل الأبناء) */
export const ORDER = Object.keys(TABLES);

export const SETTINGS = { profile: 'json', timetable: 'json', prefs: 'json' };

/** الأعمدة المشتركة لكل جدول */
export const COMMON = { created_at: 'ts', updated_at: 'ts', deleted: 'bool' };

/** المعرّفات تُكتب بين علامتي تنصيص دائماً: بعض الأسماء محجوزة في Oracle (date، number، level…) */
export const q = (name) => `"${name}"`;
