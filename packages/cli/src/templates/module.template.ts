export const getModule = (
    Name: string,
    name: string,
    fullPath: string = name,
    depth: string = '../../',
    events = false,
): string => {
    const eventsImport = events ? `import { ${Name}Events } from './${name}.events';\n` : '';
    const eventsProvider = events ? `\n    ${Name}Events,` : '';

    return `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';
${eventsImport}import { ${Name}, ${Name}Schema } from '${depth}schemas/${fullPath}.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ${Name}.name, schema: ${Name}Schema }]),
  ],
  controllers: [${Name}Controller],
  providers: [
    ${Name}Service,${eventsProvider}
  ],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`;
};
