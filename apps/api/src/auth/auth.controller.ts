import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, type Login, type LoginResponse, LoginSchema } from '@realestate-system/shared';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, Public, type RequestUser } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(PublicRateLimitGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(new ZodValidationPipe(LoginSchema)) body: Login): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }
}
