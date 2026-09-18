import { getServiceEventOptions } from './events.template';

export const getService = (
    Name: string,
    name: string,
    fullPath: string = name,
    events = false,
    broadcast = false,
    depth = '../../',
): string => {
    // `import type` keeps this a compile-time-only reference: the events file imports
    // the service as a value for @ServiceEvents(), so a runtime import here would be a cycle.
    const eventsImport = events
        ? `import type { ${Name}Events } from './${name}.events';\n`
        : '';
    const generic = events
        ? `${Name}, ${Name}Document, ${Name}Events`
        : `${Name}, ${Name}Document`;

    return `import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NestService } from '@nest-extended/mongoose';
import { ${Name}, ${Name}Document } from '${depth}schemas/${fullPath}.schema';
${eventsImport}
@Injectable()
export class ${Name}Service extends NestService<${generic}> {
  constructor(
    @InjectModel(${Name}.name) private readonly ${name}Model: Model<${Name}>,
  ) {
    super(${name}Model${getServiceEventOptions(name, events, broadcast)})
  }
}`;
};
