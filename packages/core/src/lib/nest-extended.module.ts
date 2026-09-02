import { APP_FILTER, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { DynamicModule, Inject, Module, OnApplicationBootstrap, Provider } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExtendedConfig, NEST_EXTENDED_CONFIG } from '../types/nest-extended.config';
import { UseHooksInterceptor } from '../interceptors/use-hooks.interceptor';
import { ServiceEventsRegistry } from './service-events.registry';
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
        // Register each filter class provided in config.filters as a global APP_FILTER
        const filterProviders: Provider[] = (config.filters ?? []).map((FilterClass) => ({
            provide: APP_FILTER,
            useClass: FilterClass,
        }));

        // Service events wiring and the @UseBefore / @UseAfter interceptor.
        // Opt out app-wide with `events: false`.
        const eventProviders: Provider[] =
            config.events === false
                ? []
                : [
                      ServiceEventsRegistry,
                      { provide: APP_INTERCEPTOR, useClass: UseHooksInterceptor },
                  ];

        return {
            module: NestExtendedModule,
            global: true,
            imports: [DiscoveryModule],
            providers: [
                {
                    provide: NEST_EXTENDED_CONFIG,
                    useValue: config,
                },
                ...filterProviders,
                ...eventProviders,
            ],
            exports: [NEST_EXTENDED_CONFIG],
        };
    }
}
