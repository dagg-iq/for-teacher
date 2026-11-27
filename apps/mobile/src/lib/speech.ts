/**
 * التعرّف على الكلام — أربعة محركات، يُختار الأنسب تلقائياً:
 *  - «cloud» على الحاسوب والمتصفح (الافتراضي متى توفّر حساب وإنترنت): Whisper large-v3 على خوادم سريعة —
 *    الأدق للعربية واللهجة والأسماء (الأسماء تُرسل تلميحاً)، وكل جملة تعود خلال أقل من ثانية تقريباً.
 *  - «native» على الهاتف: expo-speech-recognition (خدمة Google في أندرويد). أندرويد ١٣+ استماع متواصل بلا صفير،
 *    والأقدم جملة جملة مع إعادة تشغيل هادئة. أخطاء «مشغول/العميل» تُعاد تلقائياً بدل إيقاف الجلسة.
 *  - «web» في المتصفح (Chrome/Edge): التعرّف المدمج في المتصفح.
 *  - «whisper» داخل الجهاز: للحاسوب (Electron لا يملك خدمة Google للكلام) وللمتصفحات بلا تعرّف مدمج،
 *    ويُنتقل إليه تلقائياً إن فشل تعرّف المتصفح (شبكة/خدمة).
 * كل المحركات: مراقب بدء (لا «أستمع…» للأبد)، ورسائل عربية واضحة لكل خطأ، والأسماء تُرسل للمحرك لتحسين التعرّف.
 */
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { IS_DESKTOP } from './config';
import { buildPrompt, CloudError, cloudConfigured, cloudSignedIn, cloudTranscribe } from './cloud-stt';
import { listenMic, loadWhisper, transcribe, type MicSession, type WhisperQuality } from './whisper';

type Mod = typeof import('expo-speech-recognition');
let mod: Mod | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-speech-recognition') as Mod;
} catch {
  mod = null;
}

export type ListenState = 'idle' | 'starting' | 'loading' | 'listening' | 'error';
export type Engine = 'native' | 'cloud' | 'web' | 'whisper' | 'none';
export type EnginePref = 'auto' | 'cloud' | 'google' | 'device';

const isWeb = Platform.OS === 'web';
const hasWebSpeech = () => isWeb && typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
const hasMic = () => isWeb && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

/** المحرك المستعمل حسب الجهاز وتفضيل المدرس */
export function pickEngine(pref: EnginePref = 'auto'): Engine {
  if (!isWeb) return mod ? 'native' : 'none';
  if (pref === 'device') return hasMic() ? 'whisper' : 'none';
  // السحابي أولاً (الأدق والأسرع)؛ بلا حساب أو إنترنت ينتقل تلقائياً عند البدء
  if ((pref === 'auto' || pref === 'cloud') && cloudConfigured && hasMic()) return 'cloud';
  if (pref === 'google') return hasWebSpeech() ? 'web' : hasMic() ? 'whisper' : 'none';
  // الحاسوب: تعرّف المتصفح المدمج لا يعمل داخل Electron (يحتاج مفاتيح Google)
  if (IS_DESKTOP) return hasMic() ? 'whisper' : 'none';
  if (hasWebSpeech()) return 'web';
  return hasMic() ? 'whisper' : 'none';
}

export function speechAvailable(pref: EnginePref = 'auto'): boolean {
  const e = pickEngine(pref);
  if (e === 'native') {
    try { return !!mod?.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.(); } catch { return false; }
  }
  return e !== 'none';
}

const where = isWeb ? (IS_DESKTOP ? 'الحاسوب' : 'المتصفح') : 'الهاتف';
const ERRORS: Record<string, string> = {
  'not-allowed': isWeb
    ? 'اسمح باستخدام الميكروفون: اضغط أيقونة القفل/الميكروفون بجانب العنوان (أو من إعدادات الخصوصية في ويندوز ← الميكروفون).'
    : 'اسمح للتطبيق باستخدام الميكروفون: الإعدادات ← التطبيقات ← نَهج ← الأذونات.',
  'service-not-allowed': isWeb
    ? 'التعرّف على الكلام غير متاح في هذا المتصفح. سيُستعمل التعرّف داخل الجهاز.'
    : 'خدمة التعرّف على الكلام غير مفعّلة. ثبّت تطبيق Google (أو «خدمات الكلام من Google») وفعّل «الكتابة بالصوت».',
  'language-not-supported': 'اللغة العربية غير مثبتة في خدمة الكلام. نزّلها من: إعدادات Google ← الصوت ← اللغات (ويمكن تنزيلها للعمل بلا إنترنت).',
  network: `التعرّف على الكلام يحتاج إنترنت على ${where}. تأكد من الاتصال.`,
  'audio-capture': 'تعذّر تشغيل الميكروفون. تأكد أنه موصول وأغلق أي برنامج آخر يستخدمه.',
  busy: 'خدمة الكلام مشغولة. حاول مرة أخرى بعد لحظة.',
  client: 'تعذّر الاتصال بخدمة الكلام. حاول مرة أخرى.',
  'too-many-requests': 'طلبات كثيرة لخدمة الكلام. انتظر قليلاً ثم حاول.',
  'bad-grammar': 'تعذّر إعداد التعرّف على الكلام.',
  unknown: 'خطأ غير متوقع في التعرّف على الكلام. حاول مرة أخرى أو اكتب الأوامر.',
  timeout: `لم يبدأ التعرّف على الكلام على ${where}. حاول مرة أخرى، أو اكتب الأوامر في الخانة.`,
  unsupported: 'هذا المتصفح لا يدعم الإدخال الصوتي. استعمل Chrome أو Edge، أو اكتب الأوامر في الخانة.',
  model: 'تعذّر تنزيل نموذج الكلام. يلزم إنترنت مرة واحدة فقط لتنزيله، ثم يعمل بلا إنترنت.',
};

const CLOUD_NOTICE: Record<string, string> = {
  signin: 'التعرّف السحابي الأدق يحتاج تسجيل الدخول — استُعمل التعرّف داخل الجهاز.',
  'not-approved': 'التعرّف السحابي يعمل بعد موافقة الإدارة على حسابك — استُعمل التعرّف داخل الجهاز.',
  'not-configured': 'التعرّف السحابي غير مفعّل بعد — استُعمل التعرّف داخل الجهاز.',
  network: 'لا يوجد إنترنت — استُعمل التعرّف داخل الجهاز.',
};

let speakingUntil = 0;

/** قراءة نص بصوت عالٍ (عربي) */
export function say(text: string) {
  if (!text) return;
  speakingUntil = Date.now() + Math.min(6000, 600 + text.length * 85);
  Speech.stop().catch(() => {});
  Speech.speak(text, {
    language: 'ar',
    rate: Platform.OS === 'android' ? 1.05 : 0.55,
    onDone: () => { speakingUntil = Date.now() + 250; },
    onStopped: () => { speakingUntil = Date.now() + 150; },
    onError: () => { speakingUntil = 0; },
  });
}

const LANGS = ['ar-IQ', 'ar-SA', 'ar-EG', 'ar'];
const RETRIABLE = new Set(['busy', 'client', 'too-many-requests']);
let googleService: string | null | undefined;

/** خدمة Google للكلام إن كانت مثبتة (أدق للعربية من خدمات بعض الشركات) */
function androidService(): string | undefined {
  if (Platform.OS !== 'android' || !mod) return undefined;
  if (googleService === undefined) {
    try {
      const list = mod.ExpoSpeechRecognitionModule.getSpeechRecognitionServices?.() ?? [];
      googleService = list.find((p) => p === 'com.google.android.googlequicksearchbox') ?? list.find((p) => p === 'com.google.android.tts') ?? null;
    } catch { googleService = null; }
  }
  return googleService ?? undefined;
}

/** أندرويد ١٣+ يدعم الاستماع المتواصل بلا صفير بين الجمل */
const continuousOk = () => Platform.OS === 'ios' || isWeb || (Platform.OS === 'android' && Number(Platform.Version) >= 33);

/** onFinal يستلم كل احتمالات المحرك لما قيل (الأرجح أولاً) — يختار منها الشاشة الأنسب للسياق */
export function useRecognizer(opts: {
  onFinal: (texts: string[]) => void;
  contextual?: string[];
  pref?: EnginePref;
  quality?: WhisperQuality;
  /** ميكروفون محدد (الحاسوب/المتصفح) */
  micId?: string;
  /** رسالة جانبية (تغيير اللهجة، الانتقال لمحرك آخر…) */
  onNotice?: (text: string) => void;
}) {
  const [engine, setEngine] = useState<Engine>(() => pickEngine(opts.pref));
  const [state, setState] = useState<ListenState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const wanted = useRef(false);
  const failed = useRef(false);
  const started = useRef(false);
  const retries = useRef(0);
  const quiet = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mic = useRef<MicSession | null>(null);
  const queue = useRef(Promise.resolve());
  const busy = useRef(0);
  const cb = useRef(opts);
  cb.current = opts;
  const lang = useRef(0);
  const engineRef = useRef(engine);
  engineRef.current = engine;

  useEffect(() => { setEngine(pickEngine(opts.pref)); }, [opts.pref]);

  const fail = useCallback((code: string, raw?: string) => {
    wanted.current = false;
    failed.current = true;
    if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    setError(ERRORS[code] ?? (raw && /[؀-ۿ]/.test(raw) ? raw : ERRORS.unknown));
    setState('error');
    setVolume(0);
    setPartial('');
  }, []);

  // ---------------------------------------------------------------- المحرك المدمج (الهاتف / المتصفح)
  const begin = useCallback(() => {
    if (!mod) return;
    started.current = false;
    if (watchdog.current) clearTimeout(watchdog.current);
    // لم يصل أي حدث خلال ٧ ثوانٍ: المحرك لا يعمل هنا
    watchdog.current = setTimeout(() => {
      if (started.current || !wanted.current) return;
      try { mod?.ExpoSpeechRecognitionModule.abort(); } catch { /* */ }
      if (engineRef.current === 'web' && (cb.current.pref ?? 'auto') === 'auto' && hasMic()) { switchToWhisper(); return; }
      fail('timeout');
    }, 7000);
    try {
      mod.ExpoSpeechRecognitionModule.start({
        lang: LANGS[lang.current],
        interimResults: true,
        continuous: continuousOk(),
        maxAlternatives: 5,
        contextualStrings: (cb.current.contextual ?? []).slice(0, 100),
        addsPunctuation: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
        androidRecognitionServicePackage: androidService(),
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search', EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1100, EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 900 },
        iosTaskHint: 'dictation',
      } as never);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      fail(/not defined|not supported|undefined/i.test(msg) ? 'unsupported' : 'unknown', msg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fail]);

  useEffect(() => {
    if (!mod || (engine !== 'native' && engine !== 'web')) return;
    const M = mod.ExpoSpeechRecognitionModule;
    const alive = () => {
      started.current = true;
      if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    };
    const subs = [
      M.addListener('start', () => { alive(); failed.current = false; setState('listening'); setError(null); }),
      M.addListener('audiostart', alive),
      M.addListener('result', (e) => {
        alive();
        retries.current = 0;
        quiet.current = 0;
        const texts = (e.results ?? []).map((r) => (r?.transcript ?? '').trim()).filter(Boolean);
        if (Date.now() < speakingUntil) { setPartial(''); return; }
        if (e.isFinal) {
          setPartial('');
          if (texts.length) cb.current.onFinal(texts);
        } else setPartial(texts[0] ?? '');
      }),
      M.addListener('volumechange', (e) => setVolume(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
      M.addListener('error', (e) => {
        alive();
        // «لم يُسمع شيء» ليست خطأ: نستمر (مع إبطاء إعادة التشغيل إن طال الصمت)
        if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') { quiet.current++; return; }
        if (e.error === 'language-not-supported' && lang.current < LANGS.length - 1) {
          lang.current++;
          cb.current.onNotice?.(lang.current === 1 ? 'اللهجة العراقية غير متوفرة في خدمة الكلام — استُعملت العربية العامة.' : 'استُعملت لغة عربية بديلة في خدمة الكلام.');
          return;
        }
        if (RETRIABLE.has(e.error) && retries.current < 3 && wanted.current) { retries.current++; return; }
        // تعرّف المتصفح يحتاج خوادم Google: إن تعذّرت نكمل بالتعرّف داخل الجهاز
        if (engineRef.current === 'web' && (e.error === 'network' || e.error === 'service-not-allowed') && (cb.current.pref ?? 'auto') === 'auto' && hasMic()) {
          switchToWhisper();
          return;
        }
        fail(e.error, e.message);
      }),
      M.addListener('end', () => {
        setVolume(0);
        if (wanted.current) {
          // إعادة تشغيل هادئة؛ تتباطأ مع الصمت الطويل ومع إعادة المحاولة بعد خطأ
          const delay = Math.min(2500, (continuousOk() ? 150 : 350) * (1 + quiet.current) + retries.current * 600);
          setTimeout(() => { if (wanted.current) begin(); }, delay);
        } else if (!failed.current) setState('idle');
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      if (watchdog.current) clearTimeout(watchdog.current);
      wanted.current = false;
      try { M.abort(); } catch { /* */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [begin, engine]);

  // ---------------------------------------------------------------- مراقب الميكروفون: لا يصل صوت؟
  const peak = useRef(0);
  const silentWatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLevel = useCallback((v: number) => { setVolume(v); if (v > peak.current) peak.current = v; }, []);
  const watchMic = useCallback(() => {
    peak.current = 0;
    if (silentWatch.current) clearTimeout(silentWatch.current);
    silentWatch.current = setTimeout(() => {
      if (!wanted.current || !mic.current) return;
      if (peak.current < 0.04) {
        cb.current.onNotice?.(IS_DESKTOP
          ? 'لا يصل صوت من الميكروفون. تأكد: إعدادات ويندوز ← الخصوصية ← الميكروفون ← «السماح لتطبيقات سطح المكتب»، أو اختر ميكروفوناً آخر من إعدادات الصوت (⚙).'
          : 'لا يصل صوت من الميكروفون. تأكد من السماح به، أو اختر ميكروفوناً آخر من إعدادات الصوت.');
      }
    }, 6000);
  }, []);
  useEffect(() => () => { if (silentWatch.current) clearTimeout(silentWatch.current); }, []);

  // ---------------------------------------------------------------- Whisper داخل الجهاز
  const startWhisper = useCallback(async () => {
    setError(null);
    failed.current = false;
    setState('loading');
    let pipe: Awaited<ReturnType<typeof loadWhisper>>;
    try {
      pipe = await loadWhisper(cb.current.quality ?? 'base', (p) => setProgress(p));
    } catch {
      setProgress(null);
      fail('model');
      return;
    }
    setProgress(null);
    if (!wanted.current) { setState('idle'); return; }
    try {
      mic.current = await listenMic({
        deviceId: cb.current.micId || undefined,
        onLevel,
        onSpeech: (s) => { if (s && !busy.current) setPartial('…'); },
        onSegment: (pcm) => {
          busy.current++;
          setPartial('جارٍ التعرّف…');
          queue.current = queue.current.then(async () => {
            try {
              const text = await transcribe(pipe, pcm);
              if (text && wanted.current) cb.current.onFinal([text]);
            } catch { /* جملة واحدة تعذّرت: نكمل */ } finally {
              busy.current--;
              if (!busy.current) setPartial('');
            }
          });
        },
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'audio-capture');
      return;
    }
    if (!wanted.current) { mic.current?.stop(); mic.current = null; setState('idle'); return; }
    setState('listening');
    watchMic();
  }, [fail, onLevel, watchMic]);

  const switchToWhisper = useCallback(() => {
    cb.current.onNotice?.('تعرّف المتصفح غير متاح — استُعمل التعرّف داخل الجهاز.');
    engineRef.current = 'whisper';
    setEngine('whisper');
    if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    wanted.current = true;
    startWhisper();
  }, [startWhisper]);

  // ---------------------------------------------------------------- السحابي (Whisper large-v3)
  const netFails = useRef(0);
  const fallbackToDevice = useCallback((code: string) => {
    mic.current?.stop();
    mic.current = null;
    busy.current = 0;
    setPartial('');
    cb.current.onNotice?.(CLOUD_NOTICE[code] ?? CLOUD_NOTICE.network);
    engineRef.current = 'whisper';
    setEngine('whisper');
    if (wanted.current) startWhisper();
  }, [startWhisper]);

  const startCloud = useCallback(async () => {
    setError(null);
    failed.current = false;
    netFails.current = 0;
    setState('starting');
    if (!(await cloudSignedIn())) { fallbackToDevice('signin'); return; }
    if (!wanted.current) { setState('idle'); return; }
    const prompt = buildPrompt(cb.current.contextual ?? []);
    try {
      mic.current = await listenMic({
        endSilence: 520,
        deviceId: cb.current.micId || undefined,
        onLevel,
        onSpeech: (s) => { if (s && !busy.current) setPartial('…'); },
        onSegment: (pcm) => {
          busy.current++;
          setPartial('جارٍ التعرّف…');
          // الطلب يبدأ فوراً (بالتوازي)، والنتائج تُسلَّم بترتيب الكلام
          const job = cloudTranscribe(pcm, prompt).then((t) => ({ t, e: null as unknown }), (e: unknown) => ({ t: '', e }));
          queue.current = queue.current.then(async () => {
            const { t, e } = await job;
            busy.current = Math.max(0, busy.current - 1);
            if (!busy.current) setPartial('');
            if (!wanted.current || engineRef.current !== 'cloud') return;
            if (e instanceof CloudError) {
              if (e.code === 'signin' || e.code === 'not-approved' || e.code === 'not-configured') { fallbackToDevice(e.code); return; }
              if (e.code === 'network' && ++netFails.current >= 2) { fallbackToDevice('network'); return; }
              cb.current.onNotice?.(e.code === 'rate' ? 'طلبات كثيرة على خدمة الكلام — أعد الجملة بعد لحظة.' : e.code === 'network' ? 'انقطع الاتصال لحظة — أعد الجملة.' : 'تعذّر التعرّف على هذه الجملة — أعدها.');
              return;
            }
            netFails.current = 0;
            if (t) cb.current.onFinal([t]);
          });
        },
      });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : 'audio-capture');
      return;
    }
    if (!wanted.current) { mic.current?.stop(); mic.current = null; setState('idle'); return; }
    setState('listening');
    watchMic();
  }, [fail, fallbackToDevice, onLevel, watchMic]);

  useEffect(() => () => { mic.current?.stop(); mic.current = null; }, []);

  // ---------------------------------------------------------------- التحكم
  const start = useCallback(async () => {
    const e = engineRef.current;
    if (e === 'none') { fail(isWeb ? 'unsupported' : 'service-not-allowed'); return; }
    setError(null);
    failed.current = false;
    retries.current = 0;
    quiet.current = 0;
    wanted.current = true;
    if (e === 'whisper') { startWhisper(); return; }
    if (e === 'cloud') { startCloud(); return; }
    if (!mod) { fail('unsupported'); return; }
    setState('starting');
    if (e === 'native') {
      try {
        if (!mod.ExpoSpeechRecognitionModule.isRecognitionAvailable()) { fail('service-not-allowed'); return; }
      } catch { /* نكمل ونترك المحرك يحدد */ }
    }
    const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) { fail('not-allowed'); return; }
    if (!wanted.current) return;
    begin();
  }, [begin, fail, startWhisper, startCloud]);

  const stop = useCallback(() => {
    wanted.current = false;
    setPartial('');
    setVolume(0);
    if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    if (engineRef.current === 'whisper' || engineRef.current === 'cloud') { mic.current?.stop(); mic.current = null; busy.current = 0; }
    else { try { mod?.ExpoSpeechRecognitionModule.stop(); } catch { /* */ } }
    setState('idle');
  }, []);

  return { state, partial, error, volume, start, stop, engine, progress, available: engine !== 'none' };
}
