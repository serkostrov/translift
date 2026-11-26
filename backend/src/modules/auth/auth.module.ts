import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { SessionService } from '../../common/auth/session.service.js';
import { AuthController } from './auth.controller.js';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 600 }],
      // В e2e один «клиент» входит десятки раз подряд — лимит там мешает
      skipIf: () => process.env.THROTTLE_DISABLED === 'true',
    }),
  ],
  controllers: [AuthController],
  providers: [
    SessionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
