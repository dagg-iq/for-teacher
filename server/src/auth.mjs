/**
 * التحقق من هوية المدرس: رمز JWT من مزوّد الدخول (Supabase Auth أو Firebase أو غيره).
 *  - JWKS_URL: مفاتيح المزوّد العامة (مثل https://<project>.supabase.co/auth/v1/.well-known/jwks.json)
 *  - أو JWT_SECRET: سرّ مشترك (HS256)
 * هوية المدرس = sub في الرمز، وكل صف في Oracle يُربط بها (owner_id).
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = process.env.JWKS_URL ? createRemoteJWKSet(new URL(process.env.JWKS_URL)) : null;
const secret = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;
const audience = process.env.JWT_AUDIENCE || undefined;
const issuer = process.env.JWT_ISSUER || undefined;

export async function userFrom(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const key = jwks ?? secret;
  if (!key) throw new Error('لم يُضبط JWKS_URL أو JWT_SECRET');
  const { payload } = await jwtVerify(token, key, { audience, issuer });
  return payload.sub ? String(payload.sub) : null;
}
