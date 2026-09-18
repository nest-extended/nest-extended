export const getPrismaModule = (Name: string, name: string, events = false): string => {
    const eventsImport = events ? `import { ${Name}Events } from './${name}.events';\n` : '';
    const eventsProvider = events ? `\n    ${Name}Events,` : '';

    return `import { Module } from '@nestjs/common';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';
${eventsImport}
@Module({
  controllers: [${Name}Controller],
  providers: [
    ${Name}Service,${eventsProvider}
  ],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`;
};
