import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Env } from './common/config/env.js';

/** Общая настройка приложения — для main.ts и e2e-тестов. */
export function setupApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  app.setGlobalPrefix('api');
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN'), credentials: true });
  app.enableShutdownHooks();
  return config;
}
