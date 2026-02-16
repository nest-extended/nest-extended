const getControllerSpec = (Name, name) => `import { Test, TestingModule } from '@nestjs/testing';
import { ${Name}Controller } from './${name}.controller';

describe('${Name}Controller', () => {
  let controller: ${Name}Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${Name}Controller],
    }).compile();

    controller = module.get<${Name}Controller>(${Name}Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
`;

module.exports = getControllerSpec;
