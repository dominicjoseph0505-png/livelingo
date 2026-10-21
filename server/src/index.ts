import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { CONFIG } from './config/index.js';
import { apiRouter } from './routes/api.js';
import { callingSignalingServer } from './modules/calling/signaling.js';

const app = express();
const server = http.createServer(app);

// Setup middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (CONFIG.corsOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
        return;
      }
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Origin not allowed by CORS'));
        return;
      }
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Initialize WebSocket server on /ws path
const wss = new WebSocketServer({
  server,
  path: '/ws',
});

callingSignalingServer.initialize(wss);

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`===============================================`);
  console.log(`  LiveLingo Calling Server listening on http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`  WebSocket Signaling ready on ws://${CONFIG.host}:${CONFIG.port}/ws`);
  console.log(`  Languages: English, Kannada, Hindi, Spanish, German, Tamil`);
  console.log(`===============================================`);
});

// Process signal handling
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('[LiveLingo Server] Gracefully shut down.');
  });
});
