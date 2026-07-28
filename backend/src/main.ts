import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const isProd = process.env.NODE_ENV === 'production';

  // Behind Render/Vercel proxies — trust the first hop so client IPs (used by
  // the rate limiter) and protocol are read from X-Forwarded-* correctly.
  app.set('trust proxy', 1);

  // Security headers (CSP, HSTS, frame/mime protections). Cross-origin resource
  // policy is relaxed so the SPA on another origin can load /uploads images.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: isProd ? undefined : false,
    }),
  );

  app.setGlobalPrefix('api');
  // Serve locally-stored uploads at /uploads (Cloudinary URLs are absolute).
  // `nosniff` stops the browser MIME-sniffing an upload into an executable type.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  });
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    // `whitelist: true` strips any property not declared in the DTO before it
    // reaches a service — this is the mass-assignment control. `forbidNonWhitelisted`
    // is intentionally left OFF: it would 400 requests carrying extra fields and
    // break existing forms; stripping is sufficient and non-breaking.
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger exposes the full API surface — keep it out of production.
  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Elite Event Management API')
      .setDescription('REST API for the Elite Event Management Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 API running on http://localhost:${port}${isProd ? '' : '  (Swagger: /docs)'}`);
}
bootstrap();
