import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

const app = express();

// Behind nginx, the real client IP arrives in X-Forwarded-For. Without this,
// every request looks like it came from 127.0.0.1 and one user tripping the
// rate limiter would lock out everyone.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Vite injects the stylesheet as a plain <link>, so no inline styles to
        // allow. If a library ever needs 'unsafe-inline' here, that is worth
        // resisting rather than waving through.
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],

        // Deliberately omitted until Phase 11. upgrade-insecure-requests would
        // rewrite requests to https, which breaks testing a production build
        // locally over plain HTTP.
        upgradeInsecureRequests: null,
      },
    },
  })
);

// Development only. In production the frontend is served from this same origin,
// so no cross-origin request ever occurs and CORS is dead weight.
if (!env.isProd) {
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.use('/api', apiLimiter, routes);

if (env.isProd) {
  // Hashed filenames, so the bundle can be cached hard. index.html must not be,
  // or a browser keeps loading an old page that points at deleted assets.
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      maxAge: '1y',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  /**
   * SPA fallback: any GET that is not an API call and matched no file gets
   * index.html, so React Router can handle the path.
   *
   * Written as middleware rather than a wildcard route on purpose. Express 5
   * upgraded path-to-regexp, and the familiar `app.get('*')` is no longer valid
   * syntax — it throws at startup.
   */
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();

    // A request for a file that does not exist must 404, not receive HTML.
    // Otherwise a stale index.html asking for a deleted bundle gets a page back
    // where a script was expected, and the browser reports it as
    // "Unexpected token '<'" — which says nothing about the real problem.
    //
    // The heuristic is "the path has a file extension". It would misfire on an
    // app route containing a dot, which this app has none of; revisit if one is
    // ever added.
    if (path.extname(req.path) !== '') return next();

    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
