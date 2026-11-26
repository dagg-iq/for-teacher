import { buildYearSet, gradeId, schoolYear, uuid, type GradeMark, type YearPlan } from '@nahj/shared';
import { get, insertMany, upsert } from './db';

/** يكتب درجة طالب في عمود (value = null يمسحها) */
export function setGrade(bookId: string, studentId: string, columnId: string, value: number | null, mark: GradeMark | null = null) {
  return upsert('grades', gradeId(bookId, studentId, columnId), { gradebook_id: bookId, student_id: studentId, column_id: columnId, value, mark });
}

export function getGrade(bookId: string, studentId: string, columnId: string) {
  return get('grades', gradeId(bookId, studentId, columnId));
}

/** سجلات السنة لشعبة أو أكثر (كل امتحان في سجله، والسعي مرتبط بها) */
export function createYearSet(sectionIds: string[], plan: YearPlan): string[] {
  const first: string[] = [];
  for (const sid of sectionIds) {
    const specs = buildYearSet(plan);
    const group = uuid();
    insertMany('gradebooks', specs.map((b) => ({
      id: b.id, section_id: sid, title: b.title, template: 'year', columns: b.columns, result: b.result, year: schoolYear(),
      group_id: group, role: b.role, ord: b.ord,
    })));
    first.push(specs[0].id);
  }
  return first;
}

/** يرفع (أو يعيد) درجات حرجة: تعديل يدوي على عمود محسوب، أو حذفه للعودة إلى الحساب */
export function setOverride(bookId: string, studentId: string, columnId: string, value: number | null) {
  return setGrade(bookId, studentId, columnId, value, null);
}
