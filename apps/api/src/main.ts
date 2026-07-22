import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

async function bootstrap() {
  console.log('BOOTSTRAP: starting...');
  try {
    const app = await NestFactory.create(AppModule);
    console.log('BOOTSTRAP: Nest app created');

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
    const port = process.env.PORT ?? 4000;
    // Health check for Railway
    app.getHttpAdapter().get('/health', (_req: any, res: any) => res.json({ ok: true }));

    await app.listen(port);
    // eslint-disable-next-line no-console
    console.log(`BOOTSTRAP: API listening on http://localhost:${port}`);
  } catch (err) {
    console.error('BOOTSTRAP FAILED:', err);
    process.exit(1);
  }
}
bootstrap();