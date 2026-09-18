type Orm = 'mongoose' | 'prisma' | 'typeorm';

/**
 * The `{name}.events.ts` scaffold.
 *
 * Only the import block and the document type differ between ORMs — the class body is
 * identical, so it is written once below.
 */
export const getEvents = (
    Name: string,
    name: string,
    orm: Orm,
    depth = '../../',
    fullPath = name,
): string => {
    const doc =
        orm === 'mongoose' ? `${Name}Document` : orm === 'typeorm' ? `${Name}` : 'any';

    const docImport =
        orm === 'mongoose'
            ? `import { ${Name}Document } from '${depth}schemas/${fullPath}.schema';\n`
            : orm === 'typeorm'
              ? `import { ${Name} } from './entities/${name}.entity';\n`
              : '';

    return `import { Injectable } from '@nestjs/common';
import {
  EventContext,
  NestServiceEvents,
  PaginatedResponse,
  ServiceEvents,
} from '@nest-extended/core';
${docImport}import { ${Name}Service } from './${name}.service';

/**
 * Lifecycle events for ${Name}Service.
 *
 * Fired by the service's public methods (find/get/create/patch/remove). The underscore
 * methods (_find/_get/...) bypass this class, so internal service-to-service calls stay
 * event-free.
 *
 * - \`before*\` hooks run inline and are awaited: return a value to replace the input.
 * - \`on*\` hooks run after the response has been sent: they cannot change it, and a
 *   throw is logged rather than surfaced to the client.
 *
 * Inject anything you need in the constructor:
 *
 *     constructor(
 *       @InjectModel(Profile.name) private readonly profileModel: Model<ProfileDocument>,
 *       private readonly mailService: MailService,
 *     ) {
 *       super();
 *     }
 */
@Injectable()
@ServiceEvents(${Name}Service)
export class ${Name}Events extends NestServiceEvents<${Name}Service, ${doc}> {
  // Reshape the payload before it is written. Whatever you return replaces the input.
  //
  // beforeCreate(data: any, ctx: EventContext<${Name}Service>) {
  //   return { ...data, createdVia: ctx.user ? 'api' : 'system' };
  // }

  onFind(result: PaginatedResponse<${doc}> | ${doc}[], ctx: EventContext<${Name}Service>) {
    this.logger.debug(
      \`\${ctx.hook ?? 'onFind'}: \${Array.isArray(result) ? result.length : result.total} record(s)\`,
    );
  }

  onGet(result: ${doc} | null, ctx: EventContext<${Name}Service>) {
    this.logger.debug(\`\${ctx.hook ?? 'onGet'}: \${result ? 1 : 0} record(s)\`);
  }

  onCreate(result: ${doc} | ${doc}[], ctx: EventContext<${Name}Service>) {
    this.logger.debug(
      \`\${ctx.hook ?? 'onCreate'}: \${Array.isArray(result) ? result.length : 1} record(s)\`,
    );
  }

  onPatch(result: ${doc} | ${doc}[] | null, ctx: EventContext<${Name}Service>) {
    this.logger.debug(
      \`\${ctx.hook ?? 'onPatch'}: \${Array.isArray(result) ? result.length : result ? 1 : 0} record(s)\`,
    );
  }

  onRemove(result: ${doc} | ${doc}[] | null, ctx: EventContext<${Name}Service>) {
    this.logger.debug(
      \`\${ctx.hook ?? 'onRemove'}: \${Array.isArray(result) ? result.length : result ? 1 : 0} record(s)\`,
    );
  }
}
`;
};

/** Options object rendered into a generated service's `super(...)` call. */
export const getServiceEventOptions = (
    name: string,
    events: boolean,
    broadcast: boolean,
): string => {
    if (!events) return '';
    return broadcast
        ? `, { events: true, broadcast: '${name}' }`
        : `, { events: true }`;
};
