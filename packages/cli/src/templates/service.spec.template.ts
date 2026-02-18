
export const getServiceSpec = (Name: string, name: string): string => `import { Test, TestingModule } from '@nestjs/testing';
import { ${Name}Service } from './${name}.service';

describe('${Name}Service', () => {
  let service: ${Name}Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [${Name}Service],
    }).compile();

    service = module.get<${Name}Service>(${Name}Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
`;
