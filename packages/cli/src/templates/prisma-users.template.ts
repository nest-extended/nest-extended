
/**
 * Prisma-compatible Users templates.
 * Same functionality as the Mongoose users templates but using Prisma.
 */

export const getPrismaUsersModel = (): string => `
model Users {
  id        String    @id @default(cuid())
  firstName String
  lastName  String
  email     String    @unique
  password  String
  phone     String?
  role      Int       @default(1)
  deleted   Boolean?  @default(false)
  deletedAt DateTime?
  deletedBy String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
`;

export const getPrismaUsersService = (): string => `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NestService } from '@nest-extended/prisma';

@Injectable()
export class UsersService extends NestService<any> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.users);
  }

  sanitizeUser(user: Record<string, any>) {
    const sanitized = { ...user };
    delete sanitized['password'];
    return sanitized;
  }
}
`;

export const getPrismaUsersController = (): string => `import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '@nest-extended/decorators';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  async find(@Query() query: Record<string, any>) {
    return await this.usersService._find(query);
  }

  @Get('/:id')
  async get(@Query() query: Record<string, any>, @Param('id') id: string) {
    return await this.usersService._get(id, query);
  }

  @Public()
  @Post()
  async create(@Body() createUsersDto: Record<string, any>) {
    if (!createUsersDto.email || !createUsersDto.password) {
      throw new BadRequestException('Email or Password not provided!');
    }

    const saltOrRounds = 10;
    const password = await bcrypt.hash(createUsersDto.password, saltOrRounds);

    const user = await this.usersService._create({
      ...createUsersDto,
      password,
    }) as Record<string, any>;

    const sanitizedUser = this.usersService.sanitizeUser(user);
    const payload = { sub: { id: user.id }, user };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: sanitizedUser,
    };
  }

  @Patch('/:id')
  async patch(
    @Query() query: Record<string, any>,
    @Body() patchUsersDto: Record<string, any>,
    @Param('id') id: string,
  ) {
    delete patchUsersDto.email;
    return await this.usersService._patch(id, patchUsersDto, query);
  }

  @Patch('/:id/block')
  async block(
    @Body() patchUsersDto: { blocked: boolean },
    @Param('id') id: string,
  ) {
    return await this.usersService._patch(
      id,
      { blocked: patchUsersDto?.blocked ?? true },
      {},
    );
  }
}
`;

export const getPrismaUsersModule = (): string => `import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
`;
