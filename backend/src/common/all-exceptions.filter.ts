import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Global exception filter. Ensures clients never receive raw Prisma errors or
 * stack traces, maps known Prisma error codes to safe HTTP statuses, and logs
 * the real error server-side for diagnostics.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Pass through Nest's own HTTP exceptions (already client-safe).
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return res.status(status).json(exception.getResponse());
    }

    // Map common Prisma errors to safe statuses without leaking details.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { status, message } = this.mapPrismaError(exception.code);
      this.logger.warn(`Prisma ${exception.code}: ${exception.message.split('\n').pop()}`);
      return res.status(status).json({ statusCode: status, message });
    }

    // Anything else → generic 500, full detail logged only server-side.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }

  private mapPrismaError(code: string): { status: number; message: string } {
    switch (code) {
      case 'P2002':
        return { status: HttpStatus.CONFLICT, message: 'A record with this value already exists.' };
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found.' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'Invalid reference.' };
      default:
        return { status: HttpStatus.BAD_REQUEST, message: 'Request could not be processed.' };
    }
  }
}
