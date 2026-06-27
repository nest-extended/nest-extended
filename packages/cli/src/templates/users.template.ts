export const getUsersSchema = (): string => `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UsersDocument = HydratedDocument<Users>;

@Schema({
  timestamps: true,
})
export class Users {
  _id: Types.ObjectId;

  @Prop({ type: String, trim: true, required: true })
  firstName: string;

  @Prop({ type: String, trim: true, required: true })
  lastName: string;

  @Prop({ type: String, trim: true, unique: true, required: true })
  email: string;

  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, trim: true, required: false })
  phone?: string;

  @Prop({ type: Number, enum: [1, 2, 3], default: 1 })
  role: number;
}

export const UsersSchema = SchemaFactory.createForClass(Users);
`;

export const getUsersService = (): string => `import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NestService } from '@nest-extended/mongoose';
import { Users, UsersDocument } from '../../schemas/users.schema';

@Injectable()
export class UsersService extends NestService<Users, UsersDocument> {
  constructor(
    @InjectModel(Users.name) private readonly usersModel: Model<UsersDocument>,
  ) {
    super(usersModel);
  }

  sanitizeUser(user: UsersDocument) {
    const sanitized = user.toObject() as unknown as Record<string, unknown>
    delete sanitized['password'];
    return sanitized;
  }
}
`;

export const getUsersController = (): string => `import {
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
import { Users } from '../../schemas/users.schema';
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
  async create(@Body() createUsersDto: Users) {
    if (!createUsersDto.email || !createUsersDto.password) {
      throw new BadRequestException('Email or Password not provided!');
    }

    const saltOrRounds = 10;
    const password = await bcrypt.hash(createUsersDto.password, saltOrRounds);

    const user = await this.usersService._create({
      ...createUsersDto,
      password,
    });

    const sanitizedUser = this.usersService.sanitizeUser(user);
    const payload = { sub: { id: user._id }, user };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: sanitizedUser,
    };
  }

  @Patch('/:id')
  async patch(
    @Query() query: Record<string, any>,
    @Body() patchUsersDto: Partial<Users>,
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
