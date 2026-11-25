import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { SessionService } from '../../common/auth/session.service.js';
import { AuthController } from './auth.controller.js';

@Global()
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }])],
  controllers: [AuthController],
  providers: [
    SessionService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
