
export const getTypeOrmModule = (Name: string, name: string): string => `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${Name} } from './entities/${name}.entity';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';

@Module({
  imports: [TypeOrmModule.forFeature([${Name}])],
  controllers: [${Name}Controller],
  providers: [
    ${Name}Service,
  ],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`;
