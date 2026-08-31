import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';

import { GetSessionUseCase } from './application/get-session.usecase';
import { LoginUseCase } from './application/login.usecase';
import { AUTH_USER_REPOSITORY } from './application/ports/auth-user.repository';
import type { AuthUserRepository } from './application/ports/auth-user.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import type { PasswordHasher } from './application/ports/password-hasher';
import { TOKEN_ISSUER } from './application/ports/token-issuer';
import type { TokenIssuer } from './application/ports/token-issuer';
import { SESSION_TTL_SECONDS } from './domain/session';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenIssuer } from './infrastructure/jwt-token-issuer';
import { PrismaAuthUserRepository } from './infrastructure/prisma-auth-user.repository';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';
import { PermissionsGuard } from './presentation/permissions.guard';
import { SessionCookieService } from './presentation/session-cookie.service';

/**
 * Unico punto de cableado del modulo: los puertos de `application/ports/` se
 * atan aca a sus implementaciones de `infrastructure/`, y los casos de uso
 * quedan libres de decoradores de Nest.
 *
 * Los dos guards se exportan para que `app.module.ts` los registre como
 * `APP_GUARD` globales, en este orden: primero el de sesion, despues el de
 * permisos.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: requireJwtSecret(config),
        // Una jornada laboral, sin refresh tokens (RN-8).
        signOptions: { expiresIn: SESSION_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    SessionCookieService,
    { provide: AUTH_USER_REPOSITORY, useClass: PrismaAuthUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    {
      provide: LoginUseCase,
      inject: [AUTH_USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER],
      useFactory: (
        users: AuthUserRepository,
        passwords: PasswordHasher,
        tokens: TokenIssuer,
      ): LoginUseCase => new LoginUseCase(users, passwords, tokens),
    },
    {
      provide: GetSessionUseCase,
      inject: [AUTH_USER_REPOSITORY],
      useFactory: (users: AuthUserRepository): GetSessionUseCase => new GetSessionUseCase(users),
    },
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}

/** El secreto de firma es obligatorio: sin el no hay sesiones (RN-8). */
function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');

  if (secret === undefined || secret.trim() === '') {
    throw new Error('Falta JWT_SECRET. Revisa el .env de la raiz del monorepo.');
  }

  return secret;
}
