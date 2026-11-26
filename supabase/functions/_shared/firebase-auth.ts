// التحقق من رمز دخول Firebase (Google) بلا مكتبات: RS256 بمفاتيح Google العامة.
import { HttpError } from './cors.ts';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keys: { at: number; map: Map<string, CryptoKey> } | null = null;

async function key(kid: string): Promise<CryptoKey | undefined> {
  if (!keys || Date.now() - keys.at > 60 * 60 * 1000 || !keys.map.has(kid)) {
    const res = await fetch(JWKS_URL);
    if (!res.ok) throw new HttpError(503, 'تعذّر التحقق من Google، حاول بعد قليل');
    const { keys: list } = await res.json() as { keys: (JsonWebKey & { kid: string })[] };
    const map = new Map<string, CryptoKey>();
    for (const k of list) {
      map.set(k.kid, await crypto.subtle.importKey('jwk', k, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    keys = { at: Date.now(), map };
  }
  return keys.map.get(kid);
}

const b64 = (s: string) => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

export interface FirebaseUser { uid: string; email: string; name?: string; picture?: string; provider: string }

/** يتحقق من التوقيع والجهة والمدة، ويعيد البريد (موثّق) */
export async function verifyFirebaseToken(token: string, projectId: string): Promise<FirebaseUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'سجّل الدخول من جديد');
  let header: { alg?: string; kid?: string };
  let p: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64(parts[0])));
    p = JSON.parse(new TextDecoder().decode(b64(parts[1])));
  } catch {
    throw new HttpError(401, 'سجّل الدخول من جديد');
  }
  if (header.alg !== 'RS256' || !header.kid) throw new HttpError(401, 'سجّل الدخول من جديد');
  const k = await key(header.kid);
  if (!k) throw new HttpError(401, 'سجّل الدخول من جديد');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', k, b64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new HttpError(401, 'سجّل الدخول من جديد');
  const now = Math.floor(Date.now() / 1000);
  if (p.aud !== projectId || p.iss !== `https://securetoken.google.com/${projectId}`) throw new HttpError(401, 'رمز من مشروع آخر');
  if (typeof p.exp !== 'number' || p.exp < now - 30) throw new HttpError(401, 'انتهت الجلسة، سجّل الدخول من جديد');
  if (typeof p.iat !== 'number' || p.iat > now + 300) throw new HttpError(401, 'سجّل الدخول من جديد');
  if (typeof p.sub !== 'string' || !p.sub) throw new HttpError(401, 'سجّل الدخول من جديد');
  const email = typeof p.email === 'string' ? p.email.toLowerCase() : '';
  if (!email || p.email_verified !== true) throw new HttpError(403, 'البريد غير موثّق');
  const fb = p.firebase as { sign_in_provider?: string } | undefined;
  return { uid: p.sub, email, name: p.name as string | undefined, picture: p.picture as string | undefined, provider: fb?.sign_in_provider ?? '' };
}
