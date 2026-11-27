/**
 * التعرّف على الكلام داخل الجهاز (Whisper عبر transformers.js) — للحاسوب (Electron لا يملك خدمة Google للكلام)
 * وللمتصفحات التي لا تدعم التعرّف المدمج.
 *  - المكتبة تُحمَّل عند أول استعمال من /vendor/transformers (منسوخة مع التطبيق، لا من الإنترنت).
 *  - النموذج يُنزَّل مرة واحدة (من Hugging Face) ويُحفظ في الجهاز، ثم يعمل بلا إنترنت.
 *  - الميكروفون يُقرأ بـ 16 كيلوهرتز، والجمل تُقطَّع بالصمت (كاشف صوت بسيط يتكيّف مع ضوضاء الصف).
 */

import { cleanTranscript } from '@nahj/shared';

export type WhisperQuality = 'base' | 'small';

export const WHISPER_MODELS: Record<WhisperQuality, { id: string; label: string; size: string }> = {
  base: { id: 'onnx-community/whisper-base', label: 'عادي', size: '٨٠ م.ب' },
  small: { id: 'onnx-community/whisper-small', label: 'دقة أعلى', size: '٢٥٠ م.ب' },
};

interface Override { host?: string; model?: string; debug?: boolean }
/** للاختبار: مضيف ونموذج بديلان (window.__NAHJ_WHISPER__) */
const override = (): Override => (typeof window !== 'undefined' ? (window as unknown as { __NAHJ_WHISPER__?: Override }).__NAHJ_WHISPER__ ?? {} : {});

type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
const loaded = new Map<string, Promise<Pipe>>();

/** يحمّل المكتبة والنموذج (مرة واحدة لكل نموذج). onProgress: ٠–١ أثناء التنزيل */
export function loadWhisper(quality: WhisperQuality, onProgress?: (p: number, file?: string) => void): Promise<Pipe> {
  const model = override().model ?? WHISPER_MODELS[quality].id;
  const hit = loaded.get(model);
  if (hit) return hit;
  const p = (async () => {
    const base = `${window.location.origin}/vendor/transformers/`;
    // استيراد وقت التشغيل من مجلد التطبيق (لا تحزمه أداة البناء)
    const importer = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>;
    const T = await importer(`${base}transformers.min.js`) as {
      env: { allowLocalModels: boolean; useBrowserCache: boolean; remoteHost: string; remotePathTemplate: string; backends: { onnx: { wasm: { wasmPaths: string; numThreads?: number } } } };
      pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Pipe>;
    };
    T.env.allowLocalModels = false;
    T.env.useBrowserCache = typeof caches !== 'undefined';
    T.env.backends.onnx.wasm.wasmPaths = base;
    const o = override();
    if (o.host) { T.env.remoteHost = o.host; T.env.remotePathTemplate = '{model}/'; }
    // تقدّم التنزيل: مجموع كل ملفات النموذج
    const files = new Map<string, { loaded: number; total: number }>();
    return T.pipeline('automatic-speech-recognition', model, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (e: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (e.status === 'progress' && e.file && e.total) {
          files.set(e.file, { loaded: e.loaded ?? 0, total: e.total });
          let l = 0; let t = 0;
          for (const f of files.values()) { l += f.loaded; t += f.total; }
          onProgress?.(t ? l / t : 0, e.file);
        }
      },
    });
  })();
  loaded.set(model, p);
  p.catch(() => loaded.delete(model));
  return p;
}

export interface MicSession {
  stop: () => void;
}

/**
 * يستمع من الميكروفون ويقطّع الكلام إلى جمل بالصمت، ويرسل كل جملة (Float32 بـ 16 كيلوهرتز) إلى onSegment.
 * onLevel: مستوى الصوت ٠–١ (لنبض زر الميكروفون)، onSpeech: بدأ/انتهى الكلام.
 */
export async function listenMic(opts: {
  onSegment: (pcm: Float32Array) => void;
  onLevel?: (v: number) => void;
  onSpeech?: (speaking: boolean) => void;
  /** صمت (ملّي ثانية) ينهي الجملة — أقصر = أسرع، أطول = لا يقطع وقفة قصيرة داخل الجملة */
  endSilence?: number;
  /** ميكروفون محدد (من الإعدادات)؛ بدونه الافتراضي */
  deviceId?: string;
}): Promise<MicSession> {
  const audio: MediaTrackConstraints = { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  if (opts.deviceId) audio.deviceId = { exact: opts.deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ audio }).catch((e: unknown) => {
    // الميكروفون المحفوظ لم يعد موجوداً: نرجع للافتراضي
    if (opts.deviceId && (e as { name?: string })?.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ audio: { ...audio, deviceId: undefined } });
    throw e;
  });
  const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC({ sampleRate: 16000 });
  // المتصفح قد ينشئه «متوقفاً» إن لم يكن بعد ضغطة مباشرة — فلا يصل أي صوت
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const rate = ctx.sampleRate;
  const src = ctx.createMediaStreamSource(stream);
  const frame = 1024;
  const node = ctx.createScriptProcessor(frame, 1, 1);
  const frameMs = (frame / rate) * 1000;

  let floor = 0.006;
  let speaking = false;
  let silentMs = 0;
  let speechMs = 0;
  let chunks: Float32Array[] = [];
  const pre: Float32Array[] = [];
  const PRE_FRAMES = Math.ceil(300 / frameMs);
  const END_SILENCE = opts.endSilence ?? 750;
  const MAX_MS = 9000;
  const MIN_SPEECH = 160;

  const flush = () => {
    const ok = speechMs >= MIN_SPEECH;
    const parts = chunks;
    chunks = [];
    speaking = false;
    silentMs = 0;
    speechMs = 0;
    opts.onSpeech?.(false);
    if (!ok) return;
    const n = parts.reduce((s, x) => s + x.length, 0);
    let pcm: Float32Array = new Float32Array(n);
    let o = 0;
    for (const x of parts) { pcm.set(x, o); o += x.length; }
    if (rate !== 16000) pcm = resample(pcm, rate, 16000);
    if (override().debug) console.log('[whisper] segment', pcm.length, 'rate', rate, 'floor', floor.toFixed(4));
    opts.onSegment(pcm);
  };

  node.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    opts.onLevel?.(Math.min(1, rms / 0.12));
    const on = Math.max(0.009, floor * 2.6);
    if (!speaking) {
      pre.push(data);
      if (pre.length > PRE_FRAMES) pre.shift();
      if (rms > on) {
        speaking = true;
        speechMs = frameMs;
        chunks = [...pre];
        pre.length = 0;
        opts.onSpeech?.(true);
      } else {
        // ضوضاء الخلفية تتعلّم ببطء (صف فيه همس، مروحة…)
        floor = floor * 0.95 + rms * 0.05;
      }
      return;
    }
    chunks.push(data);
    if (rms > on * 0.7) { silentMs = 0; speechMs += frameMs; } else silentMs += frameMs;
    if (silentMs >= END_SILENCE || speechMs + silentMs >= MAX_MS) flush();
  };
  src.connect(node);
  node.connect(ctx.destination);
  // استئناف إن أوقفه النظام (تبديل الجهاز الصوتي، النوم…)
  const keep = setInterval(() => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); }, 1500);
  return {
    stop: () => {
      clearInterval(keep);
      try { node.disconnect(); src.disconnect(); } catch { /* */ }
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
}

function resample(input: Float32Array, from: number, to: number): Float32Array<ArrayBuffer> {
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const a = Math.floor(x);
    const b = Math.min(a + 1, input.length - 1);
    out[i] = input[a] + (input[b] - input[a]) * (x - a);
  }
  return out;
}

/** يحوّل جملة صوتية إلى نص عربي */
export async function transcribe(pipe: Pipe, pcm: Float32Array): Promise<string> {
  const r = await pipe(pcm, { language: 'arabic', task: 'transcribe', return_timestamps: false, max_new_tokens: 40 });
  const text = Array.isArray(r) ? r.map((x) => x.text).join(' ') : r.text;
  if (override().debug) console.log('[whisper]', pcm.length, JSON.stringify(text));
  return cleanTranscript(text ?? '');
}

/** جملة صوتية (16 كيلوهرتز) إلى ملف WAV ‏16-بت — للتعرّف السحابي */
export function encodeWav(pcm: Float32Array, rate = 16000): Uint8Array<ArrayBuffer> {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  // تطبيع خفيف: صوت منخفض يُرفع حتى ‎-3 dB‎ (يساعد النموذج مع ميكروفون بعيد)
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  const gain = peak > 0 && peak < 0.5 ? Math.min(6, 0.7 / peak) : 1;
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, pcm[i] * gain));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/** الميكروفونات المتاحة (الأسماء تظهر بعد السماح بالميكروفون مرة) */
export async function listMics(): Promise<{ id: string; label: string }[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  return all.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'communications')
    .map((d, i) => ({ id: d.deviceId === 'default' ? '' : d.deviceId, label: d.label || `ميكروفون ${i + 1}` }));
}
