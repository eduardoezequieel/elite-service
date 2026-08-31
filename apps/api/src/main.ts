import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;
const WEB_ORIGIN = 'http://localhost:3000';
const GLOBAL_PREFIX = 'api';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.enableCors({
    origin: [WEB_ORIGIN],
    credentials: true,
  });

  const config = app.get(ConfigService);
  const port = Number(config.get<string>('API_PORT') ?? DEFAULT_PORT) || DEFAULT_PORT;

  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/${GLOBAL_PREFIX}`, 'Bootstrap');
}

void bootstrap();
