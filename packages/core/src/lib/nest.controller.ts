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
import { Public } from '../common/decorators/Public.decorator';
import { User } from '../common/decorators/User.decorator';
import { ServiceOptions } from '../types/ServiceOptions';
import { ModifyBody, setCreatedBy } from '../common/decorators/ModifyBody.decorator';

export class NestController<T> {
    protected readonly logger = new Logger(NestController.name);

    constructor(private readonly service: ServiceOptions<T>) { }

    @Public()
    @Get()
    async find(@Query() query: Record<string, any>) {
        return await this.service._find(query);
    }

    @Get('/:id?')
    async get(@Query() query: Record<string, any>, @Param('id') id: string) {
        return await this.service._get(id, query);
    }

    @Post()
    async create(@ModifyBody(setCreatedBy()) createDto: T) {
        return await this.service._create(createDto);
    }

    @Patch('/:id?')
    async patch(
        @Query() query: Record<string, any>,
        @Body() patchDto: Partial<T>,
        @Param('id') id: string,
    ) {
        return await this.service._patch(id, patchDto, query);
    }

    @Delete('/:id?')
    async delete(
        @Param('id') id: string,
        @Query() query: Record<string, any>,
        @User() user: any,
    ) {
        return await this.service._remove(id, query, user);
    }
}