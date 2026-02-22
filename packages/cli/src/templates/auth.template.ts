export const getAuthController = (): string => `import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Get,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { UsersService } from '../users/users.service';

@Controller('authentication')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('')
  signIn(@Body() signInDto: Record<string, any>) {
    if (signInDto.strategy === 'local') {
      return this.authService.signInLocal(signInDto.email, signInDto.password);
    }
    throw new BadRequestException('Invalid Strategy');
  }

  @Get('verify')
  getProfile(@Request() req: any) {
    return {
      user: this.usersService.sanitizeUser(req.user),
      organizationUsers: req.orgUsers,
    };
  }
}
`;

export const getAuthService = (): string => `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async signInLocal(email: string, pass: string): Promise<any> {
    const [user] = await this.usersService._find({
      email,
      $limit: 1,
      $select: [
        '_id',
        'firstName',
        'lastName',
        'email',
        'password',
        'createdAt',
        'updatedAt',
      ],
    }, { pagination: false });

    if (!user) throw new UnauthorizedException();

    const passwordValid = await bcrypt.compare(pass, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException();
    }

    const sanitizedUser = this.usersService.sanitizeUser(user);
    const payload = { sub: { id: user._id }, user };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: sanitizedUser,
    };
  }
}
`;

export const getAuthModule = (): string => `import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { UsersModule } from '../users/users.module';
import { jwtConstants } from './constants/jwt-constants';

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '365d' },
    }),
  ],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
`;

export const getAuthGuard = (): string => `import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { jwtConstants } from './constants/jwt-constants';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private reflector: Reflector,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request as Request);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });
      const user = await this.usersService._get(payload.sub.id);
      if (user) {
        request['user'] = user;
        this.cls.set('user', user);
        return true;
      }
    } catch {
      throw new UnauthorizedException();
    }
    throw new UnauthorizedException();
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
`;

export const getPublicDecorator = (): string => `import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
`;

export const getJwtConstants = (): string => `import { randomBytes } from 'crypto';
// NOTE: For a real application, consider using a more secure way to inject the secret (like ConfigService)
export const jwtConstants = {
  secret: process.env.JWT_SECRET || randomBytes(32).toString('hex'),
};
`;
