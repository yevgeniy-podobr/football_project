import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Outcome } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StatsService } from '../stats/stats.service';
import type { CreatePredictionDto } from './dto/create-prediction.dto';
import type { UpdatePredictionDto } from './dto/update-prediction.dto';

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsService: StatsService,
  ) {}

  async create(dto: CreatePredictionDto, userId: number) {
    const match = await this.prisma.match.findUnique({ where: { id: dto.matchId } });
    if (!match) throw new NotFoundException(`Match #${dto.matchId} not found`);
    if (match.status === 'FINISHED') {
      throw new BadRequestException('Cannot predict a finished match');
    }

    const existing = await this.prisma.prediction.findUnique({
      where: { userId_matchId: { userId, matchId: dto.matchId } },
    });
    if (existing) throw new ConflictException('Prediction for this match already exists');

    return this.prisma.prediction.create({
      data: {
        userId,
        matchId: dto.matchId,
        predictedHome: dto.predictedHome,
        predictedAway: dto.predictedAway,
      },
      include: { match: { include: { homeTeam: true, awayTeam: true } }, user: true },
    });
  }

  async resolveAll(): Promise<{ resolved: number; affectedUsers: number[] }> {
    const matches = await this.prisma.match.findMany({
      where: {
        status: 'FINISHED',
        homeScore: { not: null },
        awayScore: { not: null },
        predictions: { some: { outcome: null } },
      },
      include: { predictions: { where: { outcome: null } } },
    });

    if (matches.length === 0) return { resolved: 0, affectedUsers: [] };

    const affectedUserIds = new Set<number>();
    let resolved = 0;

    for (const match of matches) {
      // biome-ignore lint/style/noNonNullAssertion: only FINISHED matches are queried above; scores are always set
      const actual = this.toOutcome(match.homeScore!, match.awayScore!);

      await this.prisma.$transaction(async (tx) => {
        for (const prediction of match.predictions) {
          const isExactScore =
            prediction.predictedHome === match.homeScore &&
            prediction.predictedAway === match.awayScore;

          await tx.prediction.update({
            where: { id: prediction.id },
            data: { outcome: actual, isExactScore },
          });

          affectedUserIds.add(prediction.userId);
          resolved++;
        }
      });
    }

    for (const userId of affectedUserIds) {
      await this.statsService.recalculate(userId);
    }

    return { resolved, affectedUsers: [...affectedUserIds] };
  }

  async findAll(userId: number) {
    return this.prisma.prediction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { match: { include: { homeTeam: true, awayTeam: true } }, user: true },
    });
  }

  async findOne(id: number) {
    const prediction = await this.prisma.prediction.findUnique({
      where: { id },
      include: { match: { include: { homeTeam: true, awayTeam: true } }, user: true },
    });
    if (!prediction) throw new NotFoundException(`Prediction #${id} not found`);
    return prediction;
  }

  async update(id: number, dto: UpdatePredictionDto) {
    const prediction = await this.findOne(id);
    if (prediction.match.status === 'FINISHED') {
      throw new BadRequestException('Cannot edit a prediction for a finished match');
    }
    return this.prisma.prediction.update({
      where: { id },
      data: dto,
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.prediction.delete({ where: { id } });
  }

  private toOutcome(home: number, away: number): Outcome {
    if (home > away) return Outcome.HOME_WIN;
    if (home === away) return Outcome.DRAW;
    return Outcome.AWAY_WIN;
  }
}
