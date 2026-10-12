import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { apiRouter } from './routes/apiRoutes';

dotenv.config();

export function createApp(): express.Application {
  const app = express();

  const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000'
  ];

  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = new Set([...defaultAllowedOrigins, ...envOrigins]);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like server-to-server, curl, or health checks)
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.has(origin) || allowedOrigins.has('*')) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} is not permitted by CORS configuration.`));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
    })
  );

  const maxPayloadSize = process.env.MAX_PAYLOAD_SIZE || '15mb';
  app.use(express.json({ limit: maxPayloadSize }));

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      service: 'GeoVision — PS08 Satellite Land Change Detection Backend',
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/api/health'
    });
  });

  app.use('/api', apiRouter);

  // 404 handler for unknown routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist.`
    });
  });

  // Centralized error handler (avoids leaking internal stack traces)
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({
        error: 'MALFORMED_JSON',
        valid: false,
        issues: [
          {
            field: 'body',
            code: 'INVALID_JSON',
            message: 'Request body contains malformed JSON syntax.'
          }
        ]
      });
      return;
    }

    if (err.type === 'entity.too.large') {
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds maximum permitted size (${maxPayloadSize}).`
      });
      return;
    }

    if (err.message?.includes('not permitted by CORS')) {
      res.status(403).json({
        error: 'CORS_ORIGIN_FORBIDDEN',
        message: err.message
      });
      return;
    }

    res.status(err.status && err.status >= 400 && err.status < 600 ? err.status : 500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred while processing the request.'
    });
  });

  return app;
}
