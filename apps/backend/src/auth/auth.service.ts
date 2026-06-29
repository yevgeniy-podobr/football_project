import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.fromEmail = config.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
  }

  async register(
    username: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) {
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already in use');
    }
    if (await this.usersService.findByUsername(username)) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.createWithPassword(
      username,
      email,
      passwordHash,
      firstName,
      lastName,
    );
    return { access_token: this.sign(user), user };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return { access_token: this.sign(user), user };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Delay to match the time a real token write + email send would take,
      // preventing timing-based email enumeration.
      await new Promise((resolve) => setTimeout(resolve, 250));
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await this.usersService.setResetToken(user.id, token, expiry);

    const appUrl = this.config.get<string>('CORS_ORIGIN') ?? 'http://localhost:5173';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: user.email,
      subject: 'Football Predictor — reset your password',
      text: `Click the link below to reset your password (valid for 15 minutes):\n\n${resetUrl}`,
      html: `<p>Click the link below to reset your password (valid for 15 minutes):</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
    if (error) throw new InternalServerErrorException('Failed to send reset email');
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.passwordHash) throw new BadRequestException('No password set for this account');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, passwordHash);
    return { message: 'Password changed successfully.' };
  }

  async updateProfile(userId: number, firstName: string | null, lastName: string | null) {
    const user = await this.usersService.updateProfile(userId, firstName, lastName);
    return { access_token: this.sign(user), user };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user?.resetTokenExpiry) throw new BadRequestException('Invalid or expired token');
    if (user.resetTokenExpiry < new Date()) throw new BadRequestException('Token has expired');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
  }

  private sign(user: {
    id: number;
    email: string;
    username: string | null;
    role: Role;
    firstName: string | null;
    lastName: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return this.jwtService.sign(payload);
  }
}
