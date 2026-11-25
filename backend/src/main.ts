import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import type { Env } from './common/config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.get('FRONTEND_ORIGIN'), credentials: true });
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder().setTitle('Транслифт API').setVersion('0.1').build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApi), {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(config.get('API_PORT'));
}
await bootstrap();
