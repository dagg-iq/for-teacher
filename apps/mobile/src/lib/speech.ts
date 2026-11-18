/**
 * التعرّف على الكلام (expo-speech-recognition) + القراءة الصوتية (expo-speech).
 * - لغة عربية عراقية (ar-IQ) مع رجوع لـ ar-SA إن لم تتوفر.
 * - استماع متواصل: إن أوقف النظام الاستماع (أندرويد قبل ١٣) نعيد تشغيله تلقائياً ما دام المدرس لم يوقفه.
 * - أسماء الطلاب تُرسل للمحرك (contextualStrings) لتحسين التعرّف عليها.
 * - ما يُقال أثناء القراءة الصوتية يُتجاهل حتى لا يسمع التطبيق نفسه.
 */
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Mod = typeof import('expo-speech-recognition');
let mod: Mod | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-speech-recognition') as Mod;
} catch {
  mod = null;
}

export type ListenState = 'idle' | 'starting' | 'listening' | 'error';

export function speechAvailable(): boolean {
  try {
    return !!mod?.ExpoSpeechRecognitionModule?.isRecognitionAvailable?.();
  } catch {
    return false;
  }
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'اسمح للتطبيق باستخدام الميكروفون من إعدادات الهاتف.',
  'service-not-allowed': 'خدمة التعرّف على الكلام غير مفعّلة. ثبّت تطبيق Google أو فعّل «الكتابة بالصوت».',
  'language-not-supported': 'اللغة العربية غير مثبتة في خدمة الكلام. نزّلها من إعدادات Google ← الصوت.',
  network: 'التعرّف على الكلام يحتاج إنترنت على هذا الهاتف. تأكد من الاتصال.',
  'audio-capture': 'تعذّر تشغيل الميكروفون. أغلق أي تطبيق آخر يستخدمه.',
  busy: 'خدمة الكلام مشغولة. حاول مرة أخرى.',
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

export function useRecognizer(opts: { onFinal: (text: string) => void; contextual?: string[] }) {
  const [state, setState] = useState<ListenState>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);
  const wanted = useRef(false);
  const onFinal = useRef(opts.onFinal);
  onFinal.current = opts.onFinal;
  const ctx = useRef(opts.contextual ?? []);
  ctx.current = opts.contextual ?? [];
  const lang = useRef('ar-IQ');

  const begin = useCallback(() => {
    if (!mod) return;
    try {
      mod.ExpoSpeechRecognitionModule.start({
        lang: lang.current,
        interimResults: true,
        continuous: true,
        maxAlternatives: 1,
        contextualStrings: ctx.current.slice(0, 100),
        addsPunctuation: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
        androidIntentOptions: { EXTRA_LANGUAGE_MODEL: 'web_search', EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500 },
        iosTaskHint: 'dictation',
      } as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر بدء الاستماع');
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!mod) return;
    const M = mod.ExpoSpeechRecognitionModule;
    const subs = [
      M.addListener('start', () => { setState('listening'); setError(null); }),
      M.addListener('result', (e) => {
        const text = e.results?.[0]?.transcript ?? '';
        if (Date.now() < speakingUntil) { setPartial(''); return; }
        if (e.isFinal) {
          setPartial('');
          if (text.trim()) onFinal.current(text.trim());
        } else setPartial(text);
      }),
      M.addListener('volumechange', (e) => setVolume(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
      M.addListener('error', (e) => {
        // «لم يُسمع شيء» ليست خطأ: نستمر
        if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') return;
        if (e.error === 'language-not-supported' && lang.current === 'ar-IQ') { lang.current = 'ar-SA'; return; }
        wanted.current = false;
        setError(ERRORS[e.error] ?? e.message ?? 'خطأ في التعرّف على الكلام');
        setState('error');
      }),
      M.addListener('end', () => {
        setVolume(0);
        if (wanted.current) setTimeout(() => { if (wanted.current) begin(); }, 250);
        else setState('idle');
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      wanted.current = false;
      try { M.abort(); } catch { /* */ }
    };
  }, [begin]);

  const start = useCallback(async () => {
    if (!mod) { setError('الإدخال الصوتي يحتاج نسخة التطبيق على الهاتف. اكتب الأوامر في الخانة بدلاً من ذلك.'); setState('error'); return; }
    setError(null);
    setState('starting');
    const perm = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      setError(ERRORS['not-allowed']);
      setState('error');
      return;
    }
    wanted.current = true;
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wanted.current = false;
    setPartial('');
    try { mod?.ExpoSpeechRecognitionModule.stop(); } catch { /* */ }
    setState('idle');
  }, []);

  return { state, partial, error, volume, start, stop, available: !!mod };
}
