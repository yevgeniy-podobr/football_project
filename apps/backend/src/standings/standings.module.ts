import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StandingsController } from './standings.controller';
import { StandingsService } from './standings.service';

@Module({
  imports: [PrismaModule],
  controllers: [StandingsController],
  providers: [StandingsService],
})
export class StandingsModule {}
