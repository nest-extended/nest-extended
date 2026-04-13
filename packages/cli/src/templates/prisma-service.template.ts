
export const getPrismaService = (Name: string, name: string): string => `import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NestService } from '@nest-extended/prisma';

@Injectable()
export class ${Name}Service extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.${name});
  }
}`;
