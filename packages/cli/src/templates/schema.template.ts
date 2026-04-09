
export const getSchema = (Name: string, UserEntity: string = 'Users', isAuthGenerated: boolean = true, dirPath: string = ''): string => {
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
    default: null,
    select: false,
  })
  updatedBy?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: ${UserEntity}.name,
    default: null,
    select: false,
  })
  deletedBy?: Types.ObjectId;
` : '';

  // Calculate schema depth correctly from schemas folder rather than services folder
  // For `src/schemas/qna/category.schema.ts`, dirPath is `qna`, depth is `../`
  const schemaDepth = dirPath ? dirPath.split('/').map(() => '../').join('') : './';
  const relativeUserPath = schemaDepth + 'users.schema';

  return `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ${UserEntity} } from '${relativeUserPath}';
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
    default: null,
    select: false,
  })
  deleted?: Boolean;

  @Prop({
    type: Date,
    default: null,
    select: false,
  })
  deletedAt?: Date;

}

export const ${Name}Schema = SchemaFactory.createForClass(${Name});
`;
};
