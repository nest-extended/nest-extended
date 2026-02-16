const getModule = (Name, name) => `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${Name}Controller } from './${name}.controller';
import { ${Name}Service } from './${name}.service';
import { ${Name}, ${Name}Schema } from 'src/schemas/${name}.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ${Name}.name, schema: ${Name}Schema }]),
  ],
  controllers: [${Name}Controller],
  providers: [
  ${Name}Service,
  ],
  exports: [${Name}Service],
})
export class ${Name}Module {}
`;

module.exports = getModule;
