/**
 * التعرّف السحابي على الكلام (دالة Supabase «transcribe» ← Whisper large-v3 على Groq).
 * أدق بكثير من النموذج داخل الجهاز، وأسرع: الجملة تعود نصاً خلال أقل من ثانية تقريباً.
 * يحتاج إنترنت وحساباً مفعّلاً؛ أسماء الطلاب وكلمات الدرجات تُرسل تلميحاً للنموذج.
 */
import { cleanTranscript } from '@nahj/shared';
import { SYNC_BACKEND } from './config';
import { isConfigured, supabase } from './supabase';
import { encodeWav } from './whisper';

export type CloudErrorCode = 'signin' | 'not-approved' | 'not-configured' | 'rate' | 'network' | 'server';
export class CloudError extends Error {
  constructor(public code: CloudErrorCode) { super(code); }
}

/** الخدمة السحابية متاحة في هذه النسخة؟ (Supabase مضبوط) */
export const cloudConfigured = isConfigured && SYNC_BACKEND === 'supabase';

const URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/** هل يوجد حساب مسجّل الدخول؟ */
export async function cloudSignedIn(): Promise<boolean> {
  if (!cloudConfigured) return false;
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return !!data.session;
}

/** تلميح للنموذج: الأسماء وكلمات الأعداد كما تُقال (يرفع دقة الأسماء كثيراً) */
export function buildPrompt(hints: string[]): string {
  let out = '';
  for (const h of hints) {
    const next = out ? `${out}، ${h}` : h;
    if (next.length > 850) break;
    out = next;
  }
  return out ? `${out}.` : '';
}

export async function cloudTranscribe(pcm: Float32Array, prompt: string): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new CloudError('signin');
  const fd = new FormData();
  fd.append('file', new Blob([encodeWav(pcm)], { type: 'audio/wav' }), 'speech.wav');
  if (prompt) fd.append('prompt', prompt);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${URL}/functions/v1/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: KEY }, body: fd, signal: ctrl.signal });
  } catch {
    throw new CloudError('network');
  } finally {
    clearTimeout(timer);
  }
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  if (res.ok) return cleanTranscript(body.text ?? '');
  if (res.status === 401) throw new CloudError('signin');
  if (res.status === 403) throw new CloudError('not-approved');
  if (res.status === 503 || res.status === 404) throw new CloudError('not-configured');
  if (res.status === 429) throw new CloudError('rate');
  throw new CloudError('server');
}
