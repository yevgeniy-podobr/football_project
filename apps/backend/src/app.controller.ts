import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('config')
  getConfig() {
    return { footballApiConfigured: Boolean(process.env.FOOTBALL_DATA_API_KEY) };
  }
}
