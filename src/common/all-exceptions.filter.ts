import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Prisma error codes that are caused by the request, not by the server.
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with this value already exists' },
  P2003: { status: HttpStatus.CONFLICT, message: 'This record is still referenced by other data and cannot be changed or deleted' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
  // Database busy: no pooled connection in time / transaction timed out. Safe to retry.
  P2024: { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'The server is busy, please retry' },
  P2028: { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'The server is busy, please retry' },
  // Write conflict or deadlock between concurrent transactions
  P2034: { status: HttpStatus.CONFLICT, message: 'The record was changed by another request, please retry' },
};

/** Maps known errors to clean HTTP responses and never leaks internals on 500. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') throw exception;
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest();

    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORS[exception.code]) {
      const { status, message } = PRISMA_ERRORS[exception.code];
      if (status === HttpStatus.SERVICE_UNAVAILABLE) {
        this.logger.warn(`${req.method} ${req.url}: ${exception.code} ${exception.message}`);
        res.setHeader('Retry-After', '2');
      }
      res.status(status).json({ statusCode: status, message });
      return;
    }

    // RESTRICT foreign keys surface as an "unknown" error (Postgres 23001)
    if (exception instanceof Prisma.PrismaClientUnknownRequestError && /violates (RESTRICT|foreign key)/.test(exception.message)) {
      const { status, message } = PRISMA_ERRORS.P2003;
      res.status(status).json({ statusCode: status, message });
      return;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid request' });
      return;
    }

    this.logger.error(
      `${req.method} ${req.url} failed`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
