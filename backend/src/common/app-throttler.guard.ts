import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash, timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/** Headers the frontend's proxy middleware adds (frontend/src/middleware.ts). */
const CLIENT_IP_HEADER = 'x-client-ip';
const PROXY_SECRET_HEADER = 'x-proxy-secret';

function sameSecret(given: unknown, expected: string): boolean {
  if (typeof given !== 'string' || !given) return false;
  // Hash first so timingSafeEqual gets equal-length buffers.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Global throttler, adapted to sitting behind the Vercel rewrite proxy.
 *
 * All browser traffic reaches us through that proxy, so `req.ip` is a Vercel
 * egress address shared by every visitor, not the visitor's own IP. Left as is,
 * each limit became one bucket for the whole site: a few concurrent homepage
 * loads 429'd everyone, and ten failed logins by anyone locked every admin out.
 *
 * - Public reads (GET/HEAD on @Public routes) skip throttling. They are
 *   idempotent and cached by the frontend.
 * - Everything else is keyed on the visitor IP the proxy forwards in
 *   `x-client-ip`, but only when the request also carries PROXY_SHARED_SECRET.
 *   The backend is publicly reachable, so without that proof a direct caller
 *   could pick a fresh IP per request and walk past the login limit. Requests
 *   without the secret (direct callers, or the secret not configured) fall back
 *   to `req.ip`, the old behaviour.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AppThrottlerGuard.name);
  private warnedNoSecret = false;

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const method = context.switchToHttp().getRequest().method;
    if (method !== 'GET' && method !== 'HEAD') return false;
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const secret = process.env.PROXY_SHARED_SECRET?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production' && !this.warnedNoSecret) {
        this.warnedNoSecret = true;
        this.logger.warn(
          'PROXY_SHARED_SECRET is not set: rate limits are keyed on the proxy IP and shared by all visitors.',
        );
      }
      return req.ip;
    }
    const clientIp = req.headers?.[CLIENT_IP_HEADER];
    if (
      typeof clientIp === 'string' &&
      clientIp.trim() &&
      sameSecret(req.headers?.[PROXY_SECRET_HEADER], secret)
    ) {
      return clientIp.trim();
    }
    return req.ip;
  }
}
