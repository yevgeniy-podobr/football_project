import { Test, TestingModule } from '@nestjs/testing';
import { Outcome } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { PredictionsService } from './predictions.service';

const makePrismaMock = (txUpdate: jest.Mock) => ({
  match: { findMany: jest.fn(), findUnique: jest.fn() },
  prediction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest
    .fn()
    .mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ prediction: { update: txUpdate } }),
    ),
});

describe('PredictionsService.resolveAll', () => {
  let service: PredictionsService;
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let txUpdate: jest.Mock;

  beforeEach(async () => {
    txUpdate = jest.fn().mockResolvedValue({});
    prismaMock = makePrismaMock(txUpdate);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: StatsService,
          useValue: { recalculate: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<PredictionsService>(PredictionsService);
  });

  const resolveWith = (
    homeScore: number,
    awayScore: number,
    predictedHome: number,
    predictedAway: number,
  ) => {
    prismaMock.match.findMany.mockResolvedValue([
      {
        id: 1,
        homeScore,
        awayScore,
        predictions: [{ id: 10, userId: 1, predictedHome, predictedAway }],
      },
    ]);
    return service.resolveAll();
  };

  it('assigns HOME_WIN when home score is higher', async () => {
    await resolveWith(2, 1, 1, 0);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { outcome: Outcome.HOME_WIN, isExactScore: false },
    });
  });

  it('assigns DRAW when scores are equal', async () => {
    await resolveWith(1, 1, 0, 0);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { outcome: Outcome.DRAW, isExactScore: false },
    });
  });

  it('assigns AWAY_WIN when away score is higher', async () => {
    await resolveWith(0, 3, 0, 1);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { outcome: Outcome.AWAY_WIN, isExactScore: false },
    });
  });

  it('sets isExactScore true when predicted scores match exactly', async () => {
    await resolveWith(2, 1, 2, 1);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { outcome: Outcome.HOME_WIN, isExactScore: true },
    });
  });

  it('sets isExactScore false when outcome matches but scores differ', async () => {
    await resolveWith(3, 1, 2, 0);
    expect(txUpdate).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { outcome: Outcome.HOME_WIN, isExactScore: false },
    });
  });
});
