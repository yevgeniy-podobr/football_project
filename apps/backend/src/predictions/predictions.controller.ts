import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/jwt.strategy';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { CreatePredictionDto } from './dto/create-prediction.dto';
import type { UpdatePredictionDto } from './dto/update-prediction.dto';
import { PredictionsService } from './predictions.service';

@UseGuards(JwtAuthGuard)
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Post()
  create(@Body() dto: CreatePredictionDto, @Req() req: { user: JwtPayload }) {
    return this.predictionsService.create(dto, req.user.sub);
  }

  @Post('resolve-all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  resolveAll() {
    return this.predictionsService.resolveAll();
  }

  @Get()
  findAll(@Req() req: { user: JwtPayload }) {
    return this.predictionsService.findAll(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.predictionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePredictionDto) {
    return this.predictionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.predictionsService.remove(id);
  }
}
