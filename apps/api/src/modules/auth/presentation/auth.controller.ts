import { loginSchema } from '@elite/shared';
import type { LoginInput, LoginResponse, SessionResponse } from '@elite/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser, Public } from '../../../common/auth/auth.decorators';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { GetSessionUseCase } from '../application/get-session.usecase';
import { LoginUseCase } from '../application/login.usecase';
import { SessionCookieService } from './session-cookie.service';

/**
 * Capa `presentation`: traduce HTTP <-> caso de uso y nada mas. La cookie es
 * transporte, no logica de negocio; los errores los formatea el filtro global.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly getSession: GetSessionUseCase,
    private readonly cookie: SessionCookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async handleLogin(
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.login.execute(input);

    this.cookie.set(response, result.token.token, result.token.expiresInSeconds);

    return result.session;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  handleLogout(@Res({ passthrough: true }) response: Response): void {
    this.cookie.clear(response);
  }

  /** Requiere sesion, pero ningun permiso: lo cubre el guard global de JWT. */
  @Get('me')
  handleMe(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponse> {
    return this.getSession.execute(user.id);
  }
}
