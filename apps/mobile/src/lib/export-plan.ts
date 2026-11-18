import { arDigits, formatDayDate, parseIsoDay } from '@rasd/shared';
import { get, getSettings } from '@/data/db';
import { sectionLabel } from '@/data/queries';
import { outputHtml, renderPage } from './export';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (s?: string | null) => esc(s).split('\n').filter((x) => x.trim()).map((x) => `<div>${x}</div>`).join('') || '—';

/** طباعة التحضير اليومي بالشكل المعتاد في دفتر التحضير */
export async function printLessonPlan(id: string) {
  const p = get('lesson_plans', id);
  if (!p) throw new Error('التحضير غير موجود');
  const prof = getSettings().profile;
  const k = p.class_id ? get('classes', p.class_id) : undefined;
  const rows: [string, string][] = [
    ['الأهداف السلوكية', lines(p.objectives)],
    ['الوسائل التعليمية', lines(p.materials)],
    ['طريقة التدريس', lines(p.method)],
    ['خطوات الدرس', lines(p.steps)],
    ['التقويم', lines(p.evaluation)],
    ['الواجب البيتي', lines(p.homework)],
  ];
  const body = `<div class="head"><div class="r">${esc(prof?.school ?? '')}<br>المادة: ${esc(k?.subject || prof?.subject || '')}</div>
<div class="c"><h1>${esc(p.title)}</h1><h2>${esc(formatDayDate(parseIsoDay(p.date)))}</h2></div>
<div class="l">الصف: ${esc(k?.name ?? '')}<br>${esc((p.section_ids ?? []).map((s) => sectionLabel(s, true)).join('، '))}</div></div>
<table>${rows.map(([h, v]) => `<tr><th style="width:24%">${h}</th><td style="text-align:right;line-height:1.9">${v}</td></tr>`).join('')}</table>
<div class="sign"><div>${prof?.gender === 'f' ? 'مدرّسة' : 'مدرّس'} المادة<span>${esc(prof?.name ?? '')}</span></div><div>المشرف / المدير<span></span></div></div>`;
  await outputHtml(await renderPage(`تحضير ${p.title}`, body), `تحضير ${p.title} ${arDigits(p.date)}`, 'pdf');
}
