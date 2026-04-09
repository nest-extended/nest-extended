
export const getDto = (Name: string): string => `import { z } from 'zod';
import { Types } from 'mongoose';

/**
 * Usage: To enable Zod validation, create a ZodValidationPipe and apply it globally or per-route.
 *
 *   // zod-validation.pipe.ts
 *   import { PipeTransform, BadRequestException } from '@nestjs/common';
 *   import { ZodSchema } from 'zod';
 *   export class ZodValidationPipe implements PipeTransform {
 *     constructor(private schema: ZodSchema) {}
 *     transform(value: unknown) {
 *       const result = this.schema.safeParse(value);
 *       if (!result.success) throw new BadRequestException(result.error);
 *       return result.data;
 *     }
 *   }
 *
 *   // Then in your controller:
 *   @UsePipes(new ZodValidationPipe(Create${Name}Validation))
 */

export const Create${Name}Validation = z.object({
  name: z.string().optional(),
  createdBy: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid creator ID',
    })
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deleted: z.boolean().optional().default(false),
  deletedBy: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid deleter ID',
    })
    .optional(),
  deletedAt: z.date().optional(),
});

export const Patch${Name}Validation = z.object({
  name: z.string().optional(),
  updatedAt: z.date().optional(),
  createdAt: z.date().optional(),
  deleted: z.boolean().optional(),
  deletedBy: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid deleter ID',
    })
    .optional(),
  deletedAt: z.date().optional(),
});

export const Remove${Name}Validation = z.object({
  id: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid user ID',
  }),
  deletedBy: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), {
      message: 'Invalid deleter ID',
    })
    .optional(),
  deletedAt: z.date().optional(),
});

export type Create${Name}DTO = z.infer<typeof Create${Name}Validation>;
export type Patch${Name}DTO = z.infer<typeof Patch${Name}Validation>;
export type Remove${Name}DTO = z.infer<typeof Remove${Name}Validation>;
`;
