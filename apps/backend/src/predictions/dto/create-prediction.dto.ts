import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreatePredictionDto {
  @IsInt()
  @IsNotEmpty()
  matchId: number;

  @IsInt()
  @Min(0)
  predictedHome: number;

  @IsInt()
  @Min(0)
  predictedAway: number;
}
