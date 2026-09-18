import { getServiceEventOptions } from './events.template';

export const getPrismaService = (
    Name: string,
    name: string,
    events = false,
    broadcast = false,
    depth = '../../',
): string => {
    // See service.template.ts for why this is an `import type`.
    const eventsImport = events
        ? `import type { ${Name}Events } from './${name}.events';\n`
        : '';
    const generic = events ? `any, ${Name}Events` : 'any';

    return `import { Injectable } from '@nestjs/common';
import { PrismaService } from '${depth}prisma/prisma.service';
import { NestService } from '@nest-extended/prisma';
${eventsImport}
@Injectable()
export class ${Name}Service extends NestService<${generic}> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.${name}${getServiceEventOptions(name, events, broadcast)});
  }
}`;
};
