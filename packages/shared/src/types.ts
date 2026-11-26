import type { Tone } from './theme';

/** حقول مشتركة لكل سجل قابل للمزامنة */
export interface Base {
  id: string;
  created_at: string;
  /** وقت آخر تعديل على الجهاز (ISO) — آخر تعديل يفوز عند المزامنة */
  updated_at: string;
  /** حذف ناعم: يبقى السجل حتى تصل المعلومة لكل الأجهزة */
  deleted?: boolean;
}

export type Stage = 'primary' | 'intermediate' | 'preparatory' | 'other';

export const STAGE_LABEL: Record<Stage, string> = {
  primary: 'ابتدائي',
  intermediate: 'متوسط',
  preparatory: 'إعدادي',
  other: 'أخرى',
};

/** الصف الدراسي (مثل: الخامس العلمي — الفيزياء) */
export interface SchoolClass extends Base {
  name: string;
  stage: Stage;
  subject: string;
  /** رقم لون التمييز في classHues */
  hue: number;
  sort: number;
}

/** الشعبة (أ، ب، ج…) */
export interface Section extends Base {
  class_id: string;
  name: string;
  room?: string | null;
  sort: number;
}

export interface Student extends Base {
  section_id: string;
  name: string;
  /** رقم الطالب في السجل (التسلسل) */
  number?: number | null;
  parent_phone?: string | null;
  notes?: string | null;
  gender?: 'm' | 'f' | null;
  sort: number;
}

/** عمود في سجل الدرجات: إدخال يدوي، أو معادلة، أو «مرتبط» يأخذ قيمته من عمود في سجل آخر */
export interface GradeColumn {
  id: string;
  name: string;
  kind: 'input' | 'formula' | 'link';
  /** الدرجة العظمى */
  max: number;
  /** معادلة بمراجع {id} — للأعمدة المحسوبة فقط */
  formula?: string;
  /** التقريب: none بلا، int لأقرب عدد صحيح (٠٫٥ للأعلى)، 1dp منزلة واحدة */
  round?: 'none' | 'int' | '1dp';
  /** يُخفى من الطباعة والتصدير */
  hidden?: boolean;
  /** للعمود المرتبط: السجل والعمود اللذان تؤخذ منهما الدرجة (مثل «المجموع» في سجل الشهر الأول) */
  source?: { book_id: string; column_id: string } | null;
  /**
   * الدرجات الحرجة: إن وقعت الدرجة المحسوبة في [from، to) يُنبَّه المدرس ويمكنه رفعها إلى to
   * (مثلاً ٤٧–٤٩ ← ٥٠). لا تُغيَّر إلا بعد موافقته.
   */
  boost?: { from: number; to: number } | null;
}

/** دور السجل ضمن سجلات السنة (للترتيب والتقارير) */
export type BookRole = 'month' | 'term' | 'mid' | 'annual' | 'final' | 'custom';

export const BOOK_ROLE_LABEL: Record<BookRole, string> = {
  month: 'امتحان شهري',
  term: 'سعي فصل',
  mid: 'نصف السنة',
  annual: 'السعي السنوي',
  final: 'نهائي',
  custom: 'سجل مخصص',
};

/** تقدير حسب النسبة المئوية من الدرجة العظمى */
export interface Band {
  /** الحد الأدنى بالنسبة المئوية (٠–١٠٠) */
  min: number;
  label: string;
  tone: Tone;
}

/** قاعدة النتيجة: أي عمود يحدد النجاح، وحد النجاح، والتقديرات */
export interface ResultRule {
  column_id: string | null;
  /** حد النجاح بالنسبة المئوية (مثل ٥٠) */
  pass: number;
  bands: Band[];
}

/** سجل درجات لشعبة واحدة */
export interface Gradebook extends Base {
  section_id: string;
  title: string;
  /** القالب الذي أُنشئ منه (للعرض فقط) */
  template?: string | null;
  columns: GradeColumn[];
  result: ResultRule;
  /** العام الدراسي، مثل ٢٠٢٦–٢٠٢٧ */
  year?: string | null;
  note?: string | null;
  archived?: boolean;
  /** يُثبَّت في أعلى القائمة */
  pinned?: boolean;
  /** معرّف «سجلات السنة» التي يتبعها السجل (تُنشأ معاً وترتبط ببعضها) */
  group_id?: string | null;
  role?: BookRole | null;
  /** الترتيب داخل المجموعة */
  ord?: number | null;
}

export type GradeMark = 'absent' | 'exempt' | 'cheat';

export const MARK_LABEL: Record<GradeMark, string> = {
  absent: 'غائب',
  exempt: 'معفى',
  cheat: 'غش',
};

/** درجة طالب في عمود — المعرّف = gradebook|student|column */
export interface Grade extends Base {
  gradebook_id: string;
  student_id: string;
  column_id: string;
  value: number | null;
  mark?: GradeMark | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غائب',
  late: 'متأخر',
  excused: 'مُجاز',
};

/** حضور طالب في يوم — المعرّف = section|date|student */
export interface Attendance extends Base {
  section_id: string;
  student_id: string;
  /** YYYY-MM-DD */
  date: string;
  status: AttendanceStatus;
  note?: string | null;
}

/** حصة في جدول الأسبوع */
export interface Slot extends Base {
  /** ٠ = الأحد … ٦ = السبت */
  day: number;
  /** رقم الحصة (يبدأ من ٠) */
  period: number;
  section_id?: string | null;
  /** عنوان حر عند عدم ربطها بشعبة (مثل: إشراف، ريادة) */
  label?: string | null;
  room?: string | null;
}

export interface PeriodTime {
  /** HH:MM */
  start: string;
  end: string;
}

export interface TimetableConfig {
  days: number[];
  periods: PeriodTime[];
  /** التذكير قبل الحصة بالدقائق (٠ = بلا تذكير) */
  remind: number;
  /** معاملات التوليد (البداية، المدة، الاستراحة، الفرص) — ليعود نموذج «أوقات الدوام» كما حُفظ */
  plan?: {
    start: string;
    count: number;
    length: number;
    gap: number;
    breaks: { after: number; length: number }[];
    /** عُدّلت أوقات بعض الحصص يدوياً بعد التوليد */
    manual?: boolean;
  } | null;
}

export type TaskKind = 'task' | 'exam' | 'event' | 'meeting' | 'holiday';

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  task: 'مهمة',
  exam: 'امتحان',
  event: 'مناسبة',
  meeting: 'اجتماع',
  holiday: 'عطلة',
};

/** مهمة أو موعد في التقويم */
export interface Task extends Base {
  title: string;
  note?: string | null;
  kind: TaskKind;
  /** ISO — موعد التنفيذ */
  due?: string | null;
  /** تذكير قبل الموعد بالدقائق */
  remind?: number | null;
  done?: boolean;
  section_id?: string | null;
}

/** التحضير اليومي (دفتر التحضير) */
export interface LessonPlan extends Base {
  /** YYYY-MM-DD */
  date: string;
  class_id?: string | null;
  section_ids?: string[];
  title: string;
  objectives?: string | null;
  materials?: string | null;
  method?: string | null;
  steps?: string | null;
  evaluation?: string | null;
  homework?: string | null;
  done?: boolean;
}

export type NoteKind = 'positive' | 'negative' | 'note';

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  positive: 'إيجابية',
  negative: 'سلبية',
  note: 'ملاحظة',
};

/** ملاحظة سلوك/مشاركة لطالب */
export interface StudentNote extends Base {
  student_id: string;
  kind: NoteKind;
  text: string;
  /** YYYY-MM-DD */
  date: string;
}

/** ملف المدرس */
export interface TeacherProfile {
  name: string;
  school: string;
  subject: string;
  governorate: string;
  gender: 'm' | 'f';
  phone?: string;
  /** يظهر في الطباعة */
  principal?: string;
  year?: string;
}

/** جداول المزامنة بالترتيب (الآباء قبل الأبناء) */
export const SYNC_TABLES = [
  'classes',
  'sections',
  'students',
  'gradebooks',
  'grades',
  'attendance',
  'slots',
  'tasks',
  'lesson_plans',
  'student_notes',
] as const;

export type TableName = (typeof SYNC_TABLES)[number];

export interface TableRow {
  classes: SchoolClass;
  sections: Section;
  students: Student;
  gradebooks: Gradebook;
  grades: Grade;
  attendance: Attendance;
  slots: Slot;
  tasks: Task;
  lesson_plans: LessonPlan;
  student_notes: StudentNote;
}

export const GOVERNORATES = [
  'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'ذي قار', 'الأنبار', 'ديالى',
  'كركوك', 'صلاح الدين', 'واسط', 'ميسان', 'المثنى', 'الديوانية', 'دهوك', 'السليمانية', 'حلبجة',
] as const;
