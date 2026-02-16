const getService = (Name, name) => `import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NestService } from '@nest-extended/core/lib/nest.service';
import { ${Name}, ${Name}Document } from 'src/schemas/${name}.schema';

@Injectable()
export class ${Name}Service extends NestService<${Name}, ${Name}Document> {
  constructor(
    @InjectModel(${Name}.name) private readonly ${name}Model: Model<${Name}Document>,
  ) {
    super(${name}Model)
  }
}`;

module.exports = getService;