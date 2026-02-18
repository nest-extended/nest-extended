import { DynamicModule, Module } from '@nestjs/common';
import { NestExtendedConfig, NEST_EXTENDED_CONFIG } from '../types/nest-extended.config';

@Module({})
export class NestExtendedModule {
    static forRoot(config: NestExtendedConfig = {}): DynamicModule {
        return {
            module: NestExtendedModule,
            global: true,
            providers: [
                {
                    provide: NEST_EXTENDED_CONFIG,
                    useValue: config,
                },
            ],
            exports: [NEST_EXTENDED_CONFIG],
        };
    }
}
