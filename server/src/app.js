import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Behind nginx, the real client IP arrives in X-Forwarded-For. Without this,
// every request looks like it came from 127.0.0.1 and one user tripping the
// rate limiter would lock out everyone.
app.set('trust proxy', 1);

app.use(helmet());

// Development only. In production the client is served from this same origin,
// so no cross-origin request ever occurs and CORS is dead weight.
if (!env.isProd) {
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api', routes);

// Phase 8 adds static serving of client/dist plus the SPA fallback here.

app.use(notFound);
app.use(errorHandler);

export default app;
