import { Injectable, NotFoundException } from '@nestjs/common';
import { Outcome } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recomputes PredictionStats for a single user from their resolved predictions.
   * Runs inside a transaction so the read snapshot and the upsert are consistent —
   * a concurrent resolveAll cannot partially update stats mid-calculation.
   */
  async recalculate(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    return this.prisma.$transaction(async (tx) => {
      const predictions = await tx.prediction.findMany({
        where: { userId, outcome: { not: null } },
      });

      let correct = 0;
      let exactScores = 0;
      let homeWinCorrect = 0;
      let drawCorrect = 0;
      let awayWinCorrect = 0;

      for (const p of predictions) {
        const predicted = this.toOutcome(p.predictedHome, p.predictedAway);
        const isCorrect = predicted === p.outcome;

        if (isCorrect) {
          correct++;
          if (p.outcome === Outcome.HOME_WIN) homeWinCorrect++;
          else if (p.outcome === Outcome.DRAW) drawCorrect++;
          else awayWinCorrect++;
        }
        if (p.isExactScore) exactScores++;
      }

      const total = predictions.length;
      const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

      return tx.predictionStats.upsert({
        where: { userId },
        update: {
          total,
          correct,
          exactScores,
          homeWinCorrect,
          drawCorrect,
          awayWinCorrect,
          accuracy,
        },
        create: {
          userId,
          total,
          correct,
          exactScores,
          homeWinCorrect,
          drawCorrect,
          awayWinCorrect,
          accuracy,
        },
      });
    });
  }

  async getUserStats(userId: number) {
    const stats = await this.prisma.predictionStats.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!stats) throw new NotFoundException(`No stats found for user #${userId}`);
    return stats;
  }

  /** Aggregate overview across all users. */
  async getGlobalStats() {
    const [totals, users] = await Promise.all([
      this.prisma.predictionStats.aggregate({
        _sum: { total: true, correct: true, exactScores: true },
        _avg: { accuracy: true },
      }),
      this.prisma.predictionStats.count(),
    ]);

    return {
      users,
      total: totals._sum.total ?? 0,
      correct: totals._sum.correct ?? 0,
      exactScores: totals._sum.exactScores ?? 0,
      averageAccuracy: Math.round((totals._avg.accuracy ?? 0) * 10) / 10,
    };
  }

  private toOutcome(home: number, away: number): Outcome {
    if (home > away) return Outcome.HOME_WIN;
    if (home === away) return Outcome.DRAW;
    return Outcome.AWAY_WIN;
  }
}
