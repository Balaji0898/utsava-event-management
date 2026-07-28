import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { requireSecret } from './env.util';

/**
 * Best-effort check of whether the incoming request carries a valid admin
 * access token. Used on @Public() list endpoints that expose a richer
 * "include inactive/unapproved" view ONLY to admins — anonymous callers get the
 * public-safe view regardless of any `?all=true` flag. Never throws.
 */
export async function isAdminRequest(req: Request, jwt: JwtService): Promise<boolean> {
  try {
    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return false;
    const token = header.slice(7).trim();
    if (!token) return false;
    const payload: any = await jwt.verifyAsync(token, {
      secret: requireSecret('JWT_ACCESS_SECRET'),
    });
    return payload?.role === 'ADMIN' || payload?.role === 'SUPER_ADMIN';
  } catch {
    return false;
  }
}
