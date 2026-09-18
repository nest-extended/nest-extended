import { SetMetadata, Type } from '@nestjs/common';

/** Metadata key linking an events class to the service it belongs to. */
export const SERVICE_EVENTS_TARGET = 'nest-extended:service-events-target';

/**
 * Attaches an events class to a service.
 *
 * ```ts
 * @Injectable()
 * @ServiceEvents(CompanyService)
 * export class CompanyEvents extends NestServiceEvents<CompanyService, CompanyDocument> {}
 * ```
 *
 * Both classes must be listed in the feature module's `providers`, and the app must
 * import `NestExtendedModule.forRoot()` — that is what runs the wiring.
 */
export const ServiceEvents = (serviceClass: Type<any>): ClassDecorator =>
    SetMetadata(SERVICE_EVENTS_TARGET, serviceClass);
