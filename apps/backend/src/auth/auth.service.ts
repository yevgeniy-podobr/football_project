import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import type { UsersService } from '../users/users.service';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly mailer: nodemailer.Transporter;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.mailer = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT'),
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async register(username: string, email: string, password: string) {
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email already in use');
    }
    if (await this.usersService.findByUsername(username)) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.createWithPassword(username, email, passwordHash);
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

    await this.mailer.sendMail({
      from: this.config.get<string>('SMTP_USER'),
      to: user.email,
      subject: 'Football Predictor — reset your password',
      text: `Click the link below to reset your password (valid for 15 minutes):\n\n${resetUrl}`,
      html: `<p>Click the link below to reset your password (valid for 15 minutes):</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user?.resetTokenExpiry) throw new BadRequestException('Invalid or expired token');
    if (user.resetTokenExpiry < new Date()) throw new BadRequestException('Token has expired');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, passwordHash);
  }

  private sign(user: { id: number; email: string; username: string | null; role: Role }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }
}
