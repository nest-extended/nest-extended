import { Injectable } from '@nestjs/common';
import NestService from "@nest-extended/core";

@Injectable()
export class AppService extends NestService<any, any> {
  getData(): { message: string } {
    return { message: 'Hello API' };
  }
}
