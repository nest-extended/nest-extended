import {
    Body,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Logger,
} from '@nestjs/common';
import { Public, User, ModifyBody, setCreatedBy } from '@nest-extended/decorators';
import { ServiceOptions } from '../types/ServiceOptions';

export class NestController<T> {
    protected readonly logger = new Logger(NestController.name);

    constructor(private readonly service: ServiceOptions<T>) { }

    @Public()
    @Get()
    async find(@Query() query: Record<string, any>) {
        // Prefer the event-firing method; fall back for services that only
        // implement the underscore contract.
        return await (this.service.find
            ? this.service.find(query)
            : this.service._find(query));
    }

    @Get('/:id')
    async get(@Query() query: Record<string, any>, @Param('id') id: string) {
        return await (this.service.get
            ? this.service.get(id, query)
            : this.service._get(id, query));
    }

    @Post()
    async create(@ModifyBody(setCreatedBy()) createDto: T) {
        return await (this.service.create
            ? this.service.create(createDto)
            : this.service._create(createDto));
    }

    @Patch('/:id')
    async patch(
        @Query() query: Record<string, any>,
        @Body() patchDto: Partial<T>,
        @Param('id') id: string,
    ) {
        return await (this.service.patch
            ? this.service.patch(id, patchDto, query)
            : this.service._patch(id, patchDto, query));
    }

    @Delete('/:id')
    async delete(
        @Param('id') id: string,
        @Query() query: Record<string, any>,
        @User() user: any,
    ) {
        return await (this.service.remove
            ? this.service.remove(id, query, user)
            : this.service._remove(id, query, user));
    }
}