import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type Env } from '../config/env.js';
import { ChatTokenService } from './chat-token.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.CHAT_TOKEN_SECRET }),
    }),
  ],
  providers: [ChatTokenService],
  exports: [ChatTokenService],
})
export class ChatTokenModule {}
