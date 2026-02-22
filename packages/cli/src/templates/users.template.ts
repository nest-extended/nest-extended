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
    const sanitized = user.toObject() as Record<string, unknown>;
    delete sanitized['password'];
    return sanitized;
  }
}
`;
