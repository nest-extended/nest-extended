import { getServiceEventOptions } from './events.template';

export const getTypeOrmService = (
    Name: string,
    name: string,
    events = false,
    broadcast = false,
): string => {
    // See service.template.ts for why this is an `import type`.
    const eventsImport = events
        ? `import type { ${Name}Events } from './${name}.events';\n`
        : '';
    const generic = events ? `${Name}, ${Name}Events` : `${Name}`;

    return `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { ${Name} } from './entities/${name}.entity';
${eventsImport}
@Injectable()
export class ${Name}Service extends NestService<${generic}> {
  constructor(
    @InjectRepository(${Name})
    private readonly ${name}Repository: Repository<${Name}>,
  ) {
    super(${name}Repository${getServiceEventOptions(name, events, broadcast)});
  }
}
`;
};
