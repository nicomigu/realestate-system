import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ENV, type Env } from './config/env.js';

// Shared by main.ts and the test harness, so tests run the app as it is deployed.
export function setupApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  app.useLogger(app.get(Logger));

  // The web app lives on another origin (Vercel), so browsers need CORS to call the API.
  app.enableCors({ origin: env.WEB_ORIGIN });

  if (env.NODE_ENV === 'production') {
    // Behind Render's proxy, the client's IP is in X-Forwarded-For. Rate limiting keys on it.
    app.getHttpAdapter().getInstance().set('trust proxy', true);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('realestate-system API')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, swaggerConfig));
}
