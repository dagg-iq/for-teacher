import { gradeId, type GradeMark } from '@rasd/shared';
import { get, upsert } from './db';

/** يكتب درجة طالب في عمود (value = null يمسحها) */
export function setGrade(bookId: string, studentId: string, columnId: string, value: number | null, mark: GradeMark | null = null) {
  return upsert('grades', gradeId(bookId, studentId, columnId), { gradebook_id: bookId, student_id: studentId, column_id: columnId, value, mark });
}

export function getGrade(bookId: string, studentId: string, columnId: string) {
  return get('grades', gradeId(bookId, studentId, columnId));
}
