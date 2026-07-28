import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';
import { requireSecret } from '../common/env.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  private async signTokens(sub: string, email: string, role: Role) {
    const payload = { sub, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: requireSecret('JWT_ACCESS_SECRET'),
        expiresIn: process.env.JWT_ACCESS_TTL ?? '900s',
      }),
      this.jwt.signAsync(payload, {
        secret: requireSecret('JWT_REFRESH_SECRET'),
        expiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashed },
    });
  }

  private sanitize(user: any) {
    const { passwordHash, refreshToken, ...safe } = user;
    return safe;
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ForbiddenException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: Role.CUSTOMER,
      },
    });

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitize(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitize(user), ...tokens };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { success: true };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.refreshToken) throw new ForbiddenException('Access denied');

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) throw new ForbiddenException('Access denied');

    const tokens = await this.signTokens(user.id, user.email, user.role);
    await this.persistRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  /** DPDP right to correction — a user updates their own profile fields. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
    return this.sanitize(user);
  }

  /**
   * DPDP right to erasure — a user deletes their own account. Their bookings are
   * anonymized (personal fields scrubbed, link severed) rather than kept intact,
   * so no identifying data survives the deletion.
   */
  async deleteAccount(userId: string) {
    await this.prisma.booking.updateMany({
      where: { customerId: userId },
      data: {
        customerId: null,
        customerName: 'Deleted user',
        customerEmail: 'deleted@removed.invalid',
        customerPhone: null,
      },
    });
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }
}
