import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { UsersService } from './users.service';

class UpsertUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  name?: string;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  upsert(@Body() dto: UpsertUserDto) {
    return this.usersService.upsert(dto.email, dto.name);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
