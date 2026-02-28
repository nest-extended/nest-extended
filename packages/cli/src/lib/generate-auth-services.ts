import * as path from 'path';
import * as fs from 'fs-extra';
import { getModule } from '../templates/module.template';
import {
    getAuthController,
    getAuthGuard,
    getAuthModule,
    getAuthService,
    getJwtConstants,
} from '../templates/auth.template';
import { getUsersController, getUsersSchema, getUsersService } from '../templates/users.template';
import { getDto } from '../templates/dto.template';

export const generateAuthServices = (appDir: string) => {
    // 5. Generate Users Service
    const usersDir = path.join(appDir, 'src/services/users');
    const schemasDir = path.join(appDir, 'src/schemas');
    fs.ensureDirSync(usersDir);
    fs.ensureDirSync(schemasDir);

    fs.writeFileSync(path.join(schemasDir, 'users.schema.ts'), getUsersSchema());
    fs.writeFileSync(path.join(usersDir, 'users.module.ts'), getModule('Users', 'users'));
    fs.writeFileSync(path.join(usersDir, 'users.service.ts'), getUsersService());
    fs.writeFileSync(path.join(usersDir, 'users.controller.ts'), getUsersController());
    fs.ensureDirSync(path.join(usersDir, 'dto'));
    fs.writeFileSync(path.join(usersDir, 'dto/users.dto.ts'), getDto('Users'));

    // 6. Generate Auth Service
    const authDir = path.join(appDir, 'src/services/auth');
    fs.ensureDirSync(authDir);
    fs.ensureDirSync(path.join(authDir, 'constants'));

    fs.writeFileSync(path.join(authDir, 'auth.module.ts'), getAuthModule());
    fs.writeFileSync(path.join(authDir, 'auth.service.ts'), getAuthService());
    fs.writeFileSync(path.join(authDir, 'auth.controller.ts'), getAuthController());
    fs.writeFileSync(path.join(authDir, 'auth.guard.ts'), getAuthGuard());
    fs.writeFileSync(path.join(authDir, 'constants/jwt-constants.ts'), getJwtConstants());
};
