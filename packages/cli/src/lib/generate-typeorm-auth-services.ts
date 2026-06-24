import * as path from 'path';
import * as fs from 'fs-extra';
import {
    getTypeOrmAuthController,
    getTypeOrmAuthGuard,
    getTypeOrmAuthModule,
    getTypeOrmAuthService,
    getTypeOrmJwtConstants,
} from '../templates/typeorm-auth.template';
import {
    getTypeOrmUsersController,
    getTypeOrmUsersEntity,
    getTypeOrmUsersModule,
    getTypeOrmUsersService,
} from '../templates/typeorm-users.template';
import { getTypeOrmDto } from '../templates/typeorm-dto.template';

export const generateTypeOrmAuthServices = (appDir: string) => {
    // 1. Generate Users service (entity + repository-backed service)
    const usersDir = path.join(appDir, 'src/services/users');
    fs.ensureDirSync(usersDir);
    fs.ensureDirSync(path.join(usersDir, 'entities'));

    fs.writeFileSync(path.join(usersDir, 'users.module.ts'), getTypeOrmUsersModule());
    fs.writeFileSync(path.join(usersDir, 'users.service.ts'), getTypeOrmUsersService());
    fs.writeFileSync(path.join(usersDir, 'users.controller.ts'), getTypeOrmUsersController());
    fs.writeFileSync(path.join(usersDir, 'entities/users.entity.ts'), getTypeOrmUsersEntity());
    fs.ensureDirSync(path.join(usersDir, 'dto'));
    fs.writeFileSync(path.join(usersDir, 'dto/users.dto.ts'), getTypeOrmDto('Users'));

    // 2. Generate Auth service
    const authDir = path.join(appDir, 'src/services/auth');
    fs.ensureDirSync(authDir);
    fs.ensureDirSync(path.join(authDir, 'constants'));

    fs.writeFileSync(path.join(authDir, 'auth.module.ts'), getTypeOrmAuthModule());
    fs.writeFileSync(path.join(authDir, 'auth.service.ts'), getTypeOrmAuthService());
    fs.writeFileSync(path.join(authDir, 'auth.controller.ts'), getTypeOrmAuthController());
    fs.writeFileSync(path.join(authDir, 'auth.guard.ts'), getTypeOrmAuthGuard());
    fs.writeFileSync(path.join(authDir, 'constants/jwt-constants.ts'), getTypeOrmJwtConstants());
};
