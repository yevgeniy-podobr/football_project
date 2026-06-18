import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findByResetToken(token: string) {
    return this.prisma.user.findFirst({ where: { resetToken: token } });
  }

  createWithPassword(
    username: string,
    email: string,
    passwordHash: string,
    firstName?: string,
    lastName?: string,
  ) {
    return this.prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        name: username,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      },
    });
  }

  updateProfile(id: number, firstName: string | null, lastName: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { firstName, lastName },
    });
  }

  setResetToken(id: number, token: string, expiry: Date) {
    return this.prisma.user.update({
      where: { id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });
  }

  updatePassword(id: number, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
  }
}
