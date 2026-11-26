import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/auth/password.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import type { Role } from '../src/contracts/index.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  setupApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

let seq = 0;

/** Создаёт пользователя и возвращает агент supertest с его сессией. */
export async function signIn(app: NestExpressApplication, role: Role) {
  const prisma = app.get(PrismaService);
  const login = `test-${role.toLowerCase()}-${Date.now()}-${seq++}`;
  const password = 'test-password-1';
  const user = await prisma.user.create({
    data: { login, fullName: `Тест ${role}`, role, passwordHash: await hashPassword(password) },
  });
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/login').send({ method: 'login', value: login, password }).expect(200);
  return { agent, user };
}
