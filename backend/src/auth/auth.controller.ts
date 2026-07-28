import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tight limit to blunt account-enumeration and registration spam.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // Tight limit to blunt online password guessing / credential stuffing.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser('id') userId: string) {
    return this.auth.logout(userId);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: { id: string; refreshToken: string }) {
    return this.auth.refresh(user.id, user.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }

  // DPDP right to correction — update own profile.
  @ApiBearerAuth()
  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(userId, dto);
  }

  // DPDP right to erasure — delete own account (bookings anonymized).
  @ApiBearerAuth()
  @Delete('me')
  deleteAccount(@CurrentUser('id') userId: string) {
    return this.auth.deleteAccount(userId);
  }
}
