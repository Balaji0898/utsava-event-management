import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * Global throttler that leaves public reads (GET/HEAD on @Public routes) alone.
 *
 * All site traffic reaches us through the Vercel rewrite proxy, so `req.ip` is a
 * Vercel egress address shared by every visitor, not the visitor's own IP. A
 * per-IP bucket on public reads therefore became one bucket for the whole site:
 * a few concurrent homepage loads exhausted it and every visitor then got 429s
 * (empty sections, "Couldn't load events"). Those reads are idempotent and are
 * cached by the frontend, so they don't need the brute-force limit. Writes,
 * auth and admin routes are still throttled, including the stricter per-route
 * @Throttle limits.
 */
@Injectable()
export class PublicReadThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const method = context.switchToHttp().getRequest().method;
    if (method !== 'GET' && method !== 'HEAD') return false;
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true;
  }
}
