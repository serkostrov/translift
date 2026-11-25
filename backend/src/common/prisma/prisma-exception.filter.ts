import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

/** Ошибки Prisma → понятные HTTP-ответы вместо 500. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Такая запись уже существует'],
      P2003: [HttpStatus.CONFLICT, 'Запись связана с другими данными'],
      P2025: [HttpStatus.NOT_FOUND, 'Запись не найдена'],
    };
    const [statusCode, message] = map[error.code] ?? [
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Ошибка базы данных',
    ];
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) console.error(error);
    res.status(statusCode).json({ statusCode, message, code: error.code });
  }
}
