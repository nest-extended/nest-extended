import * as path from 'path';
import * as fs from 'fs-extra';
import {
    getPrismaAuthController,
    getPrismaAuthGuard,
    getPrismaAuthModule,
    getPrismaAuthService,
    getPrismaJwtConstants,
} from '../templates/prisma-auth.template';
import {
    getPrismaUsersController,
    getPrismaUsersModel,
    getPrismaUsersModule,
    getPrismaUsersService,
} from '../templates/prisma-users.template';
import { getPrismaDto } from '../templates/prisma-dto.template';

export const generatePrismaAuthServices = (appDir: string) => {
    // 1. Generate Users Service
    const usersDir = path.join(appDir, 'src/services/users');
    fs.ensureDirSync(usersDir);

    fs.writeFileSync(path.join(usersDir, 'users.module.ts'), getPrismaUsersModule());
    fs.writeFileSync(path.join(usersDir, 'users.service.ts'), getPrismaUsersService());
    fs.writeFileSync(path.join(usersDir, 'users.controller.ts'), getPrismaUsersController());
    fs.ensureDirSync(path.join(usersDir, 'dto'));
    fs.writeFileSync(path.join(usersDir, 'dto/users.dto.ts'), getPrismaDto('Users'));

    // 2. Append Users model to schema.prisma
    const prismaSchemaPath = path.join(appDir, 'prisma/schema.prisma');
    if (fs.existsSync(prismaSchemaPath)) {
        const content = fs.readFileSync(prismaSchemaPath, 'utf8');
        if (!content.includes('model Users {')) {
            const usersModel = getPrismaUsersModel();
            fs.appendFileSync(prismaSchemaPath, '\n' + usersModel);
        }
    }

    // 3. Generate Auth Service
    const authDir = path.join(appDir, 'src/services/auth');
    fs.ensureDirSync(authDir);
    fs.ensureDirSync(path.join(authDir, 'constants'));

    fs.writeFileSync(path.join(authDir, 'auth.module.ts'), getPrismaAuthModule());
    fs.writeFileSync(path.join(authDir, 'auth.service.ts'), getPrismaAuthService());
    fs.writeFileSync(path.join(authDir, 'auth.controller.ts'), getPrismaAuthController());
    fs.writeFileSync(path.join(authDir, 'auth.guard.ts'), getPrismaAuthGuard());
    fs.writeFileSync(path.join(authDir, 'constants/jwt-constants.ts'), getPrismaJwtConstants());
};
