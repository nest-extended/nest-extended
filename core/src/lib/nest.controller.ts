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
import { ModifyBody, setCreatedBy } from '../common/decorators/ModifyBody.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { ServiceOptions } from 'src/types/ServiceOptions';

export class GlobalController<T> {
    protected readonly logger = new Logger(GlobalController.name);

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