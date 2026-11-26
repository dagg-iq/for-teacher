// التعرّف السحابي على الكلام: Whisper large-v3 على خوادم Groq (سريع جداً ودقيق في العربية).
// التطبيق يرسل جملة قصيرة (WAV 16 كيلوهرتز) + تلميح بأسماء الطلاب وكلمات الدرجات، فيعود النص.
// للحسابات المفعّلة فقط؛ المفتاح GROQ_API_KEY يبقى في الخادم.
//   POST multipart/form-data { file, prompt? }
import { HttpError, handler, json } from '../_shared/cors.ts';
import { admin, requireUser } from '../_shared/supabase.ts';

const MAX_BYTES = 1_500_000; // ~45 ثانية WAV 16 كيلوهرتز
const approved = new Map<string, number>(); // ذاكرة قصيرة: لا نسأل القاعدة مع كل جملة

interface Seg { text: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number }

Deno.serve(handler(async (req) => {
  if (req.method !== 'POST') throw new HttpError(405, 'POST فقط');
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new HttpError(503, 'not-configured');
  const user = await requireUser(req);
  const until = approved.get(user.id) ?? 0;
  if (until < Date.now()) {
    const { data } = await admin().from('teacher_accounts').select('status').eq('id', user.id).maybeSingle();
    if (data && data.status !== 'approved') throw new HttpError(403, 'not-approved');
    approved.set(user.id, Date.now() + 10 * 60 * 1000);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) throw new HttpError(400, 'لا يوجد صوت');
  if (file.size > MAX_BYTES) throw new HttpError(413, 'الجملة طويلة جداً');
  const prompt = String(form?.get('prompt') ?? '').slice(0, 900);

  const out = new FormData();
  out.append('file', file, 'speech.wav');
  out.append('model', Deno.env.get('GROQ_MODEL') || 'whisper-large-v3');
  out.append('language', 'ar');
  out.append('temperature', '0');
  out.append('response_format', 'verbose_json');
  if (prompt) out.append('prompt', prompt);

  const t0 = Date.now();
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: out });
    if (res.status < 500) break;
  }
  if (!res || !res.ok) {
    const body = await res?.text().catch(() => '') ?? '';
    console.error('groq', res?.status, body.slice(0, 300));
    if (res?.status === 429) throw new HttpError(429, 'rate');
    if (res?.status === 401 || res?.status === 403) throw new HttpError(503, 'not-configured');
    throw new HttpError(502, 'upstream');
  }
  const r = await res.json() as { text?: string; segments?: Seg[] };
  // نحذف المقاطع التي يرجّح النموذج أنها صمت/ضجيج (مصدر «الهلوسة»)
  const segs = (r.segments ?? []).filter((s) => !((s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -0.8) && (s.compression_ratio ?? 0) < 2.6);
  const text = (r.segments ? segs.map((s) => s.text).join(' ') : r.text ?? '').replace(/\s+/g, ' ').trim();
  return json({ text, ms: Date.now() - t0 });
}));
