import { buildYearSet, defaultBoost, gradeId, schoolYear, uuid, type Gradebook, type GradeMark, type YearPlan } from '@nahj/shared';
import { get, insertMany, updateMany, upsert } from './db';

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

/**
 * يطبّق قواعد الدرجات على سجلات موجودة: حد النجاح، ونطاق الدرجات الحرجة في الأعمدة المحسوبة التي فيها تنبيه
 * (below = ٠ يلغي التنبيه). الدرجات نفسها لا تتغير — فقط الحكم (ناجح/راسب) والتنبيه.
 */
export function applyGradeRules(books: Gradebook[], rules: { pass: number; below: number }) {
  updateMany('gradebooks', books.map((b) => ({
    id: b.id,
    patch: {
      result: { ...b.result, pass: rules.pass },
      columns: b.columns.map((c) => {
        // التنبيه في السعي والأعمدة التي كان فيها تنبيه (لا نضيفه لأعمدة الإدخال)
        const eligible = c.kind === 'formula' && (!!c.boost || (b.group_id && b.role !== 'month' && b.role !== 'mid' && c.id === b.result.column_id));
        if (!eligible) return c;
        return { ...c, boost: rules.below > 0 ? defaultBoost(c.max, rules.pass, rules.below) : null };
      }),
    },
  })));
}

/** يرفع (أو يعيد) درجات حرجة: تعديل يدوي على عمود محسوب، أو حذفه للعودة إلى الحساب */
export function setOverride(bookId: string, studentId: string, columnId: string, value: number | null) {
  return setGrade(bookId, studentId, columnId, value, null);
}
