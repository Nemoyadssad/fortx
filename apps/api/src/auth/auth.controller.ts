import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, TelegramLoginDto } from './dto';
import { Public } from '../common/auth/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.displayName, {
      promoCode: dto.promoCode,
      marketingOptIn: dto.marketingOptIn,
    });
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('telegram')
  telegramLogin(@Body() dto: TelegramLoginDto) {
    return this.auth.loginWithTelegram(dto.initData);
  }
  
  // Protected by the global JwtAuthGuard — echoes the authenticated user.
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }
}
