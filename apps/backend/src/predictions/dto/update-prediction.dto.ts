import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePredictionDto } from './create-prediction.dto';

export class UpdatePredictionDto extends PartialType(
  OmitType(CreatePredictionDto, ['matchId'] as const),
) {}
