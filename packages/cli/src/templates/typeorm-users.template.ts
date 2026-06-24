
/**
 * TypeORM-compatible Users templates.
 * Same functionality as the Prisma/Mongoose users templates but using a TypeORM
 * entity + repository.
 */

export const getTypeOrmUsersEntity = (): string => `import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ type: 'int', default: 1 })
  role: number;

  @Column({ default: false, nullable: true })
  deleted?: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;

  @Column({ nullable: true })
  deletedBy?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;

export const getTypeOrmUsersService = (): string => `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NestService } from '@nest-extended/typeorm';
import { Users } from './entities/users.entity';

@Injectable()
export class UsersService extends NestService<Users> {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
  ) {
    super(usersRepository);
  }

  sanitizeUser(user: Record<string, any>) {
    const sanitized = { ...user };
    delete sanitized['password'];
    return sanitized;
  }
}
`;

export const getTypeOrmUsersController = (): string => `import {
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

    if (patchUsersDto.password) {
      const saltOrRounds = 10;
      patchUsersDto.password = await bcrypt.hash(
        patchUsersDto.password,
        saltOrRounds,
      );
    }

    return await this.usersService._patch(id, patchUsersDto, query);
  }
}
`;

export const getTypeOrmUsersModule = (): string => `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([Users])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
`;
