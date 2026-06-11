import './prisma/ensure-database-url';
import { prepareDatabase } from './prisma/prepare-database';
import { startStartupProbeServer, stopStartupProbeServer } from './startup-probe-server';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.API_PORT ?? 80);
  const probeServer = await startStartupProbeServer(port);

  try {
    await prepareDatabase();
  } finally {
    await stopStartupProbeServer(probeServer);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = app.get(ConfigService);
  const listenPort = Number(config.get<string>('API_PORT') ?? port);
  const configuredWebRoot = config.get<string>('WEB_STATIC_PATH')?.trim();
  const bundledWebRoot = join(__dirname, '..', 'public');
  const webRoot =
    [configuredWebRoot, bundledWebRoot].filter(Boolean).find((candidate) => existsSync(join(candidate!, 'index.html'))) ??
    configuredWebRoot ??
    bundledWebRoot;
  const webIndex = join(webRoot, 'index.html');
  const serveWeb = existsSync(webIndex);

  if (configuredWebRoot && configuredWebRoot !== webRoot) {
    console.warn(
      `[web] WEB_STATIC_PATH=${configuredWebRoot} 未找到 index.html，已回退到内置静态目录 ${webRoot}`,
    );
  }

  if (serveWeb) {
    app.useStaticAssets(webRoot);
    app.getHttpAdapter().getInstance().get(/^(?!\/api\/v1).*/, (req: Request, res: Response, next: NextFunction) => {
      if (!['GET', 'HEAD'].includes(req.method)) {
        next();
        return;
      }
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
        next();
        return;
      }
      res.sendFile(webIndex);
    });
  } else {
    console.warn(`[web] 未找到 PC Web 入口文件：${webIndex}，当前仅提供 API /api/v1`);
  }

  await app.init();
  await app.listen(listenPort, '0.0.0.0');

  const modes = ['API /api/v1'];
  if (serveWeb) {
    modes.push(`PC Web / -> ${webRoot}`);
  }
  console.log(`VaultPass listening on 0.0.0.0:${listenPort} (${modes.join(', ')})`);
}

bootstrap().catch((error) => {
  console.error('[fatal] 应用启动失败', error);
  process.exit(1);
});
