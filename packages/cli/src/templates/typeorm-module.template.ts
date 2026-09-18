export const getTypeOrmModule = (Name: string, name: string, events = false): string => {
    const eventsImport = events ? `import { ${Name}Events } from './${name}.events';\n` : '';
    const eventsProvider = events ? `\n    ${Name}Events,` : '';

    return `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${Name} } from './entities/${name}.entity';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';
${eventsImport}
@Module({
  imports: [TypeOrmModule.forFeature([${Name}])],
  controllers: [${Name}Controller],
  providers: [
    ${Name}Service,${eventsProvider}
  ],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`;
};
