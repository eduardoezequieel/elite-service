import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3200;
const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // La sesion viaja en una cookie httpOnly (RN-8): hay que poder leerla.
  app.use(cookieParser());

  app.setGlobalPrefix(GLOBAL_PREFIX);

  const config = app.get(ConfigService);
  const webOrigin = config.get<string>('WEB_ORIGIN');

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Peticiones sin origen (SSR, herramientas locales, mobile, curl)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Origen web configurado explicitamente
      if (webOrigin && origin === webOrigin) {
        callback(null, true);
        return;
      }
      // Cualquier puerto local durante desarrollo (ej. localhost:3000, localhost:3100, 127.0.0.1)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });

  const port = Number(config.get<string>('API_PORT') ?? DEFAULT_PORT) || DEFAULT_PORT;

  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/${GLOBAL_PREFIX}`, 'Bootstrap');
}

void bootstrap();
