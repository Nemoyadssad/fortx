import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @Get('top')
  top() {
    return this.news.top();
  }

  @Public()
  @Get()
  search(@Query('q') q = '') {
    return this.news.search(q);
  }
}
