
export const getPrismaDtoClassValidator = (Name: string): string => `import { IsString, IsOptional, IsBoolean, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Usage: To enable class-validator validation, add the following to your main.ts:
 *
 *   import { ValidationPipe } from '@nestjs/common';
 *   app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
 *
 * Or apply per-route using @UsePipes(new ValidationPipe({ transform: true }))
 */

export class Create${Name}Dto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;

  @IsString()
  @IsOptional()
  deletedBy?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deletedAt?: Date;
}

export class Patch${Name}Dto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  updatedAt?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  createdAt?: Date;

  @IsBoolean()
  @IsOptional()
  deleted?: boolean;

  @IsString()
  @IsOptional()
  deletedBy?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deletedAt?: Date;
}

export class Remove${Name}Dto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  deletedBy?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  deletedAt?: Date;
}
`;
