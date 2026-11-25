import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { setupApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = setupApp(app);

  const openApi = new DocumentBuilder().setTitle('Транслифт API').setVersion('0.1').build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, openApi), {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(config.get('API_PORT'));
}
await bootstrap();
