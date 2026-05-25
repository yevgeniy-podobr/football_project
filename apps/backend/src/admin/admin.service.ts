import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [users, predictions, matches, lastMatch] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.prediction.count(),
      this.prisma.match.count(),
      this.prisma.match.findFirst({
        orderBy: { cachedAt: 'desc' },
        select: { cachedAt: true },
      }),
    ]);

    return {
      users,
      predictions,
      matches,
      lastSyncAt: lastMatch?.cachedAt ?? null,
    };
  }
}
