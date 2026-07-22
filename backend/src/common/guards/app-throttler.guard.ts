import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard de la aplicación.
 * - Se salta el throttling cuando corre bajo Jest (la suite E2E hace muchos
 *   logins seguidos y dispararía 429), detectado por JEST_WORKER_ID.
 * - Detrás de nginx usa la IP real del cliente (X-Forwarded-For) como tracker.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return !!process.env.JEST_WORKER_ID;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const xff = req.headers?.['x-forwarded-for'];
    const forwarded = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
    return forwarded || req.ip;
  }
}
