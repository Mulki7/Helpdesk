/**
 * server.js
 * Application entry point.
 * Sets up Express, HTTP server, Socket.IO, middleware, routes, and starts listening.
 */

import './config/env.js'; // Validate env vars first — will exit on error
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { startAutoCloseJob } from './jobs/autoCloseTickets.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import deviceRoutes from './routes/device.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import userRoutes from './routes/user.routes.js';
import widgetRoutes from './routes/widget.routes.js';
import { initSocketServer } from './sockets/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Absolute paths to widget artefacts (monorepo: backend/src/ → widget/)
const WIDGET_JS = path.resolve(__dirname, '../../widget/dist/widget.js');
const DEMO_HTML = path.resolve(__dirname, '../../widget/demo.html');
// Absolute paths to web app artefacts (monorepo: backend/src/ → web/)
const WEB_DIST = path.resolve(__dirname, '../../web/dist');
const WEB_INDEX = path.resolve(WEB_DIST, 'index.html');

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO attached to HTTP server
const io = initSocketServer(httpServer);

// ── Security & parsing ────────────────────────────────────────────────────────
// Disable CSP in Helmet so React SPA scripts and styles load without restriction
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Widget endpoints allow all origins (*); staff endpoints follow CORS_ORIGINS
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

app.use((req, res, next) => {
  const isWidgetPath = req.path.startsWith('/widget') || req.path.startsWith('/api/widget')
    || req.path === '/demo';
  const origin = req.headers.origin;

  if (isWidgetPath) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Visitor-Token');
  } else {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Visitor-Token');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// ── Static widget bundle & demo page ─────────────────────────────────────────
// IMPORTANT: These must be registered BEFORE app.use('/widget', widgetRoutes)
// because Express prefix-matches '/widget' and would intercept '/widget.js'.

// Serve built widget JS bundle at /widget.js
app.get('/widget.js', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(WIDGET_JS, (err) => {
    if (err) {
      console.error('[server] widget.js not found — run npm run build:widget', err.message);
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'widget.js belum dibangun. Jalankan: npm run build:widget',
        },
      });
    }
  });
});

// Demo landing page "Toko Contoh"
app.get('/demo', (_req, res) => {
  res.sendFile(DEMO_HTML, (err) => {
    if (err) {
      res.status(404).send('Demo page not found.');
    }
  });
});

// ── Web App (React SPA) ───────────────────────────────────────────────────────
// Serve static assets under /app (CSS, JS, images)
app.use('/app', express.static(WEB_DIST));

// SPA fallback: any sub-route under /app returns index.html for client-side routing
app.get(['/app', '/app/*'], (_req, res) => {
  res.sendFile(WEB_INDEX, (err) => {
    if (err) {
      res.status(404).send('Web app belum dibangun. Jalankan: npm run build:web');
    }
  });
});

// ── API & widget REST routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/widget', widgetRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' } });
});

// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(env.PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${env.PORT}`);
  console.log(`   NODE_ENV : ${env.NODE_ENV}`);
  startAutoCloseJob();
});

export { app, httpServer, io };
export default app;
