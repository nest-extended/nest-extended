
export const getTypeOrmService = (Name: string, name: string): string => `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { ${Name} } from './entities/${name}.entity';

@Injectable()
export class ${Name}Service extends NestService<${Name}> {
  constructor(
    @InjectRepository(${Name})
    private readonly ${name}Repository: Repository<${Name}>,
  ) {
    super(${name}Repository);
  }
}
`;
