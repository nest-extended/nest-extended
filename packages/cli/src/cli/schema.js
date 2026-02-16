const getSchema = (Name, UserEntity = 'Users') => `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ${UserEntity} } from './users.schema';
import EnsureObjectId from '@nest-extended/core/common/ensureObjectId';

export type ${Name}Document = HydratedDocument<${Name}>;

@Schema({
  timestamps: true,
})
export class ${Name} {
  @Prop({ trim: true })
  name?: string;
  
  @Prop({
    type: Types.ObjectId,
    ref: Users.name,
    default: null
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Users.name,
    default: null
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: Users.name,
    default: null
  })
  deletedBy?: Types.ObjectId;

  @Prop({
    type: Boolean,
    default: null
  })
  deleted?: Boolean;

  @Prop({
    type: Date,
    default: null
  })
  deletedAt?: Date;

}

export const ${Name}Schema = SchemaFactory.createForClass(${Name});
`;

module.exports = getSchema;
