
export const getSchema = (Name: string, UserEntity: string = 'Users', isAuthGenerated: boolean = true): string => {
  const authFields = isAuthGenerated ? `
  @Prop({
    type: Types.ObjectId,
    ref: ${UserEntity}.name,
    default: null
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: ${UserEntity}.name,
    default: null
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: ${UserEntity}.name,
    default: null
  })
  deletedBy?: Types.ObjectId;
` : '';

  return `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ${UserEntity} } from './users.schema';
import { EnsureObjectId } from '@nest-extended/mongoose';

export type ${Name}Document = HydratedDocument<${Name}>;

@Schema({
  timestamps: true,
})
export class ${Name} {
  @Prop({ trim: true })
  name?: string;
  ${authFields}
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
};
