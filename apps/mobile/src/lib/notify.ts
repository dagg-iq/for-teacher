/**
 * الإشعارات المحلية: تذكير قبل كل حصة (أسبوعي)، وتذكير المهام والامتحانات.
 * تُعاد جدولتها كلما تغيّر الجدول أو المهام (بعد ثانيتين من آخر تعديل).
 */
import { formatClock, fromMinutes, minutesLabel, toMinutes, type Task } from '@midad/shared';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { all, getSettings, getTimetable, onLocalChange } from '@/data/db';
import { sectionLabel } from '@/data/queries';

const CHANNEL = 'classes';
const TASKS_CHANNEL = 'tasks';
let configured = false;

async function setup() {
  if (configured || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'تذكير الحصص',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#4338F0',
    }).catch(() => {});
    await Notifications.setNotificationChannelAsync(TASKS_CHANNEL, {
      name: 'المهام والامتحانات',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function ensurePermission(ask = true): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await setup();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!ask || !cur.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

let lastHash = '';

/** يعيد جدولة كل الإشعارات المحلية */
export async function rescheduleAll(force = false) {
  if (Platform.OS === 'web') return;
  const s = getSettings();
  const cfg = getTimetable();
  const slots = all('slots').filter((x) => x.section_id || x.label);
  const tasks = all('tasks').filter((t) => !t.done && t.due && t.remind != null && Date.parse(t.due) - (t.remind ?? 0) * 60000 > Date.now());
  const wantClasses = s.prefs.classReminders && cfg.remind > 0 && !!s.timetable;
  const hash = JSON.stringify([wantClasses, cfg, slots.map((x) => [x.day, x.period, x.section_id, x.label, x.room]), tasks.map((t) => [t.id, t.due, t.remind, t.title])]);
  if (!force && hash === lastHash) return;
  lastHash = hash;
  const ok = await ensurePermission(false);
  if (!ok) return;
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});

  if (wantClasses) {
    for (const slot of slots) {
      const p = cfg.periods[slot.period];
      if (!p || !cfg.days.includes(slot.day)) continue;
      const at = toMinutes(p.start) - cfg.remind;
      const hhmm = fromMinutes(at);
      const [hour, minute] = hhmm.split(':').map(Number);
      // اليوم نفسه قبل منتصف الليل فقط (تذكير الحصة الأولى لا يرجع لليوم السابق)
      if (at < 0) continue;
      const title = slot.section_id ? sectionLabel(slot.section_id) : slot.label ?? 'حصة';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `حصتك بعد ${minutesLabel(cfg.remind)}`,
          body: `${title}${slot.room ? ` — ${slot.room}` : ''} · ${formatClock(p.start)}`,
          data: { route: '/schedule' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: slot.day + 1, hour, minute, channelId: CHANNEL },
      }).catch(() => {});
    }
  }

  for (const t of tasks) await scheduleTask(t);
}

async function scheduleTask(t: Task) {
  const date = new Date(Date.parse(t.due!) - (t.remind ?? 0) * 60000);
  await Notifications.scheduleNotificationAsync({
    content: { title: t.title, body: t.note || 'تذكير من مِداد', data: { route: '/tasks' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: TASKS_CHANNEL },
  }).catch(() => {});
}

/** يُشغَّل مرة في جذر التطبيق */
export function useClassReminders() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { rescheduleAll().catch(() => {}); }, 2000);
    };
    run();
    const off = onLocalChange(run);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const route = (r.notification.request.content.data as { route?: string } | undefined)?.route;
      if (route) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { router } = require('expo-router');
        router.push(route);
      }
    });
    return () => { off(); sub.remove(); if (t) clearTimeout(t); };
  }, []);
}
