import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../../contracts/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SESSION_COOKIE = 'tl_sid';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Продлеваем сессию, когда осталось меньше половины срока. */
const RENEW_AFTER_MS = SESSION_TTL_MS / 2;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Создаёт сессию и возвращает токен для cookie. В БД хранится только хеш. */
  async create(userId: string, userAgent?: string) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        tokenHash: sha256(token),
        userId,
        userAgent: userAgent?.slice(0, 300),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }

  /** Пользователь по токену; null — сессии нет, она истекла или пользователь отключён. */
  async resolve(token: string): Promise<SessionUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { include: { ledBrigade: { select: { id: true } } } } },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now || !session.user.isActive) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }

    if (session.expiresAt.getTime() - now < RENEW_AFTER_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(now + SESSION_TTL_MS), lastSeenAt: new Date(now) },
      });
    }

    const { user } = session;
    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      brigadeId: user.ledBrigade?.id ?? null,
    };
  }

  async revoke(token: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
