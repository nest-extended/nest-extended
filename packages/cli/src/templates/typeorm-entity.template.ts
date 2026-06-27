
/**
 * Generates a TypeORM entity class.
 *
 * Column types are intentionally left to TypeORM's reflection (the generated
 * app has `emitDecoratorMetadata` enabled) so each column maps to the correct
 * driver type across PostgreSQL / MySQL / SQLite.
 *
 * @param Name - PascalCase entity name
 * @param name - camelCase / table name
 * @param isAuthGenerated - Whether auth module exists (adds createdBy/updatedBy/deletedBy)
 */
export const getTypeOrmEntity = (
    Name: string,
    name: string,
    isAuthGenerated = true,
): string => {
    const authFields = isAuthGenerated
        ? `
  @Column({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  updatedBy?: string;

  @Column({ nullable: true })
  deletedBy?: string;
`
        : '';

    return `import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('${name}')
export class ${Name} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ default: false, nullable: true })
  deleted?: boolean;

  @Column({ nullable: true })
  deletedAt?: Date;
${authFields}
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
`;
};
