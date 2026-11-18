import { formatDayDate, formatTime, relativeDays, TASK_KIND_LABEL, type Task, type TaskKind } from '@midad/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Icon, type IconName } from '@/components/icon';
import { Pill, ToggleRow } from '@/components/kit';
import { PressScale, tap } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { WhenPicker } from '@/components/when';
import { Button, Card, Chip, Empty, Fab, Field, Header, IconButton, Row, Screen, SectionTitle, Segmented, T } from '@/components/ui';
import { all, insert, remove, update, useQuery } from '@/data/db';
import { allSections, sectionLabel } from '@/data/queries';
import { ensurePermission } from '@/lib/notify';
import { useTheme } from '@/lib/theme';

const KIND_ICON: Record<TaskKind, IconName> = { task: 'flag', exam: 'quiz', event: 'star', meeting: 'users', holiday: 'sun' };
const REMIND: { v: number | null; label: string }[] = [
  { v: null, label: 'بلا' }, { v: 30, label: 'قبل ٣٠ د' }, { v: 120, label: 'قبل ساعتين' }, { v: 1440, label: 'قبل يوم' },
];

export default function Tasks() {
  const { c } = useTheme();
  const [view, setView] = useState<'open' | 'done'>('open');
  const [edit, setEdit] = useState<Task | 'new' | null>(null);
  const tasks = useQuery(() => all('tasks'));
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  const done = tasks.filter((t) => t.done).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const now = new Date();
  const overdue = open.filter((t) => t.due && new Date(t.due) < now);
  const upcoming = open.filter((t) => !t.due || new Date(t.due) >= now);

  const row = (t: Task, i: number) => (
    <PressScale key={t.id} onPress={() => setEdit(t)} scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
      <PressScale onPress={() => { tap('success'); update('tasks', t.id, { done: !t.done }); }} accessibilityLabel={t.done ? 'إرجاع' : 'إنجاز'} scaleTo={0.85}
        style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: t.done ? c.accent : c.line, backgroundColor: t.done ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {t.done ? <Icon name="check" size={16} color={c.accentInk} strokeWidth={2.4} /> : null}
      </PressScale>
      <View style={{ flex: 1 }}>
        <T weight="bold" size={15} lines={2} style={t.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>{t.title}</T>
        <T dim size={12}>{[TASK_KIND_LABEL[t.kind], t.due ? `${relativeDays(new Date(t.due))} · ${formatTime(new Date(t.due))}` : null, t.section_id ? sectionLabel(t.section_id, true) : null].filter(Boolean).join(' · ')}</T>
      </View>
      <Icon name={KIND_ICON[t.kind]} size={18} color={c.ink3} />
    </PressScale>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header title="المهام والتقويم" />
        <Segmented options={[{ key: 'open', label: 'القادم' }, { key: 'done', label: 'المنجز' }]} value={view} onChange={setView} />
        {view === 'open' ? (
          open.length === 0 ? <Card><Empty icon="flag" title="لا مهام" body="أضف موعد امتحان أو تسليم درجات أو اجتماعاً، وسيذكّرك مِداد قبله." action="مهمة جديدة" onAction={() => setEdit('new')} /></Card> : (
            <>
              {overdue.length ? (<><SectionTitle title="فات موعدها" /><Card style={{ paddingVertical: 4 }}>{overdue.map(row)}</Card></>) : null}
              {upcoming.length ? (<><SectionTitle title="القادم" /><Card style={{ paddingVertical: 4 }}>{upcoming.map(row)}</Card></>) : null}
            </>
          )
        ) : done.length ? <Card style={{ paddingVertical: 4 }}>{done.map(row)}</Card> : <Card><Empty icon="check" title="لا مهام منجزة بعد" /></Card>}
        <View style={{ height: 70 }} />
      </Screen>
      <Fab title="مهمة جديدة" onPress={() => setEdit('new')} />
      {edit ? <TaskEditor task={edit === 'new' ? null : edit} onClose={() => setEdit(null)} /> : null}
    </View>
  );
}

function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'task');
  const [hasDue, setHasDue] = useState(task ? !!task.due : true);
  const [due, setDue] = useState(() => { if (task?.due) return new Date(task.due); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d; });
  const [remind, setRemind] = useState<number | null>(task?.remind ?? 1440);
  const [section, setSection] = useState<string | null>(task?.section_id ?? null);
  const sections = allSections();
  const save = async () => {
    const data = { title: title.trim(), note: note.trim() || null, kind, due: hasDue ? due.toISOString() : null, remind: hasDue ? remind : null, section_id: section };
    if (task) update('tasks', task.id, data);
    else insert('tasks', { ...data, done: false });
    if (hasDue && remind != null) await ensurePermission(true).catch(() => false);
    onClose();
  };
  return (
    <Sheet visible onClose={onClose}>
      <T display size={22}>{task ? 'تعديل' : 'مهمة جديدة'}</T>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => <Chip key={k} small label={TASK_KIND_LABEL[k]} active={kind === k} onPress={() => setKind(k)} />)}
        </Row>
        <Field value={title} onChangeText={setTitle} placeholder={kind === 'exam' ? 'مثال: امتحان الشهر الثاني' : 'العنوان'} autoFocus={!task} />
        <Field value={note} onChangeText={setNote} placeholder="تفاصيل (اختياري)" />
        <ToggleRow title="له موعد" value={hasDue} onChange={setHasDue} />
        {hasDue ? (
          <>
            <WhenPicker value={due} onChange={setDue} />
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {REMIND.map((r) => <Chip key={String(r.v)} small label={r.label} active={remind === r.v} onPress={() => setRemind(r.v)} />)}
            </Row>
          </>
        ) : null}
        {sections.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {sections.map((s) => <Chip key={s.id} small label={sectionLabel(s.id, true)} active={section === s.id} onPress={() => setSection(section === s.id ? null : s.id)} />)}
          </Row>
        ) : null}
        <Row gap={8}>
          {task ? <Button title="حذف" variant="danger" small onPress={() => { remove('tasks', task.id); onClose(); }} /> : null}
          <Button title="حفظ" icon="check" style={{ flex: 1 }} disabled={!title.trim()} onPress={save} />
        </Row>
        {hasDue ? <Pill small label={`${formatDayDate(due)} · ${formatTime(due)}`} tone="info" /> : null}
      </View>
    </Sheet>
  );
}
