import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

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

  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        stats: { select: { total: true, accuracy: true } },
        _count: { select: { predictions: true } },
      },
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      predictionCount: u._count.predictions,
      accuracy: u.stats?.accuracy ?? null,
    }));
  }

  async getUserDetail(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        stats: {
          select: { total: true, correct: true, exactScores: true, accuracy: true },
        },
        predictions: {
          orderBy: { match: { matchDate: 'desc' } },
          select: {
            id: true,
            predictedHome: true,
            predictedAway: true,
            outcome: true,
            isExactScore: true,
            createdAt: true,
            match: {
              select: {
                id: true,
                matchDate: true,
                status: true,
                homeScore: true,
                awayScore: true,
                competitionCode: true,
                homeTeam: { select: { name: true, shortName: true, crest: true } },
                awayTeam: { select: { name: true, shortName: true, crest: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User #${userId} not found`);
    return user;
  }
}
