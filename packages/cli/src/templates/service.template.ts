
export const getService = (Name: string, name: string, fullPath: string = name): string => `import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NestService } from '@nest-extended/mongoose';
import { ${Name}, ${Name}Document } from 'src/schemas/${fullPath}.schema';

@Injectable()
export class ${Name}Service extends NestService<${Name}, ${Name}Document> {
  constructor(
    @InjectModel(${Name}.name) private readonly ${name}Model: Model<${Name}Document>,
  ) {
    super(${name}Model)
  }
}`;
