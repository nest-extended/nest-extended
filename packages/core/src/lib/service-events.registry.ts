import { Injectable, Logger, OnApplicationBootstrap, OnModuleInit, Type } from '@nestjs/common';
import { DiscoveryService, ModuleRef, Reflector } from '@nestjs/core';
import { EventBus, setEventBus } from './event-bus';
import { SERVICE_EVENTS_TARGET } from './service-events.decorator';

interface EventsAware {
    registerEvents(events: unknown): void;
}

/**
 * Wires every `@ServiceEvents(X)` class to its service instance.
 *
 * Registered by `NestExtendedModule.forRoot()`. Runs on `onModuleInit` — by which point
 * Nest has already instantiated the whole provider graph — and again on
 * `onApplicationBootstrap` to catch anything registered late. Both passes are idempotent.
 */
@Injectable()
export class ServiceEventsRegistry implements OnModuleInit, OnApplicationBootstrap {
    private readonly logger = new Logger('NestExtendedEvents');
    private readonly wired = new WeakSet<object>();

    constructor(
        private readonly discovery: DiscoveryService,
        private readonly moduleRef: ModuleRef,
        private readonly reflector: Reflector,
    ) {}

    onModuleInit(): void {
        this.wire();
    }

    onApplicationBootstrap(): void {
        this.wire();
    }

    private wire(): void {
        this.resolveEventBus();

        for (const wrapper of this.discovery.getProviders()) {
            const instance = wrapper.instance as object | undefined;
            if (!instance || typeof instance !== 'object' || this.wired.has(instance)) continue;

            const target = this.reflector.get<Type<any> | undefined>(
                SERVICE_EVENTS_TARGET,
                instance.constructor,
            );
            if (!target) continue;

            const eventsName = instance.constructor.name;

            if (!wrapper.isDependencyTreeStatic()) {
                this.wired.add(instance);
                this.logger.warn(
                    `${eventsName} is request-scoped — service events are not supported for non-static providers and will not fire.`,
                );
                continue;
            }

            let service: EventsAware | undefined;
            try {
                service = this.moduleRef.get<EventsAware>(target, { strict: false });
            } catch {
                this.logger.warn(
                    `${eventsName} targets ${target.name}, which is not available in the container. ` +
                        `Add ${target.name} to the same module's providers.`,
                );
                this.wired.add(instance);
                continue;
            }

            if (!service || typeof service.registerEvents !== 'function') {
                this.logger.warn(
                    `${eventsName} targets ${target.name}, which does not extend NestService — events will not fire.`,
                );
                this.wired.add(instance);
                continue;
            }

            service.registerEvents(instance);
            this.wired.add(instance);
            this.logger.log(`${eventsName} -> ${target.name}`);
        }
    }

    /**
     * Picks up `@nestjs/event-emitter` if the host app has it installed and registered.
     * It is never a dependency of this package, so both the require and the lookup are
     * allowed to fail — broadcasting simply stays off.
     */
    private resolveEventBus(): void {
        try {
            const { EventEmitter2 } = require('@nestjs/event-emitter');
            setEventBus(this.moduleRef.get<EventBus>(EventEmitter2, { strict: false }));
        } catch {
            // Not installed, or EventEmitterModule was never registered.
        }
    }
}
