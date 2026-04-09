import { DynamicModule, Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExtendedConfig, NEST_EXTENDED_CONFIG } from '../types/nest-extended.config';
import * as qs from 'qs';

@Module({})
export class NestExtendedModule implements OnApplicationBootstrap {
    constructor(
        @Inject(NEST_EXTENDED_CONFIG) private readonly config: NestExtendedConfig,
        private readonly httpAdapterHost: HttpAdapterHost,
    ) {}

    onApplicationBootstrap() {
        const queryParserConfig = this.config.queryParser;
        if (queryParserConfig === false) return;

        // Apply qs query parser to the Express app
        const httpAdapter = this.httpAdapterHost?.httpAdapter;
        if (httpAdapter) {
            const app = httpAdapter.getInstance();
            const options = typeof queryParserConfig === 'object' ? queryParserConfig : {};
            const depth = options.depth ?? 20;
            const arrayLimit = options.arrayLimit ?? 100;
            const allowDots = options.allowDots ?? false;

            app.set('query parser', (str: string) =>
                qs.parse(str, { depth, arrayLimit, allowDots }),
            );
        }
    }

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
