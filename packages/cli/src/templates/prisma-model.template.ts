
/**
 * Generates a Prisma model block to append to schema.prisma.
 *
 * @param Name - PascalCase model name
 * @param isAuthGenerated - Whether auth module exists (adds createdBy/updatedBy/deletedBy)
 */
export const getPrismaModel = (Name: string, isAuthGenerated: boolean = true): string => {
    const authFields = isAuthGenerated ? `
  createdBy String?
  updatedBy String?
  deletedBy String?` : '';

    return `
model ${Name} {
  id        String    @id @default(cuid())
  name      String?
  deleted   Boolean?  @default(false)
  deletedAt DateTime?${authFields}
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
`;
};
