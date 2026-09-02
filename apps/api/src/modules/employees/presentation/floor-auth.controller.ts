import { floorLoginSchema } from '@elite/shared';
import type { FloorLoginInput, FloorSessionResponse } from '@elite/shared';
import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  CurrentEmployee,
  FloorSession,
  Public,
} from '../../../common/auth/auth.decorators';
import type { AuthenticatedEmployee } from '../../../common/auth/authenticated-user';
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe';
import { FloorLoginUseCase } from '../application/floor-login.usecase';
import { FloorCookieService } from './floor-cookie.service';

/**
 * Sesion de la vista pista (RN-18, RN-19).
 *
 * `@FloorSession()` va en la clase: **todas** estas rutas pertenecen a la
 * pista, asi que el guard de oficina las ignora y el de pista las exige. El
 * login y el logout son ademas `@Public()`.
 *
 * No hay nada de cobro ni de anulacion aca, y no es un olvido: la pista no
 * cobra (RN-10).
 */
@Controller('floor')
@FloorSession()
export class FloorAuthController {
  constructor(
    private readonly floorLogin: FloorLoginUseCase,
    private readonly cookies: FloorCookieService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(floorLoginSchema)) input: FloorLoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FloorSessionResponse> {
    const { session, token } = await this.floorLogin.execute(input);

    this.cookies.set(response, token.token, token.expiresInSeconds);

    return session;
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    this.cookies.clear(response);
  }

  @Get('me')
  me(@CurrentEmployee() employee: AuthenticatedEmployee): FloorSessionResponse {
    return { employee };
  }
}
