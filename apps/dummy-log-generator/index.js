const express = require('express');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 3100;

// --- In-memory log ring buffer (last 200 entries) ---
const LOG_BUFFER_SIZE = 200;
const logBuffer = [];
let logSeq = 0;

function pushToBuffer(entry) {
  if (logBuffer.length >= LOG_BUFFER_SIZE) logBuffer.shift();
  logBuffer.push({ seq: ++logSeq, ...entry });
}

// Custom winston transport that writes to the in-memory buffer
class BufferTransport extends winston.transports.Stream {
  constructor() {
    const { Writable } = require('stream');
    const writable = new Writable({
      write(chunk, _enc, cb) { cb(); } // no-op, we override log()
    });
    super({ stream: writable });
  }
  log(info, callback) {
    const { timestamp, level, message, ...meta } = info;
    pushToBuffer({ timestamp: timestamp || new Date().toISOString(), level, message, ...meta });
    callback();
  }
}

// --- Winston logger ---
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `[${timestamp}] ${level}: ${message}${metaStr}`;
        })
      ),
    }),
    new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new BufferTransport(),
  ],
});

// --- Data pools ---
const services = ['auth-service', 'payment-service', 'user-service', 'inventory-service', 'notification-service', 'api-gateway'];
const endpoints = ['/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/payments/charge', '/api/inventory/check'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const httpStatuses = [200, 201, 204, 400, 401, 403, 404, 409, 422, 500, 502, 503];

const infoMessages = [
  'User login successful',
  'Database connection established',
  'API request completed',
  'Cache hit for user data',
  'File uploaded successfully',
  'Email sent to user',
  'Background job completed',
  'Session created',
  'Payment processed',
  'Report generated successfully',
  'Config reloaded from remote source',
  'Order dispatched to fulfillment queue',
];
const warnMessages = [
  'High memory usage detected',
  'API rate limit approaching',
  'Deprecated function called',
  'Cache miss - fetching from database',
  'Slow query detected: 1420ms on users table',
  'Connection retry attempted',
  'Configuration missing, using default',
  'Token expiring soon',
  'Disk space running low',
  'Queue size increasing',
  'Retry attempt 2/3 for payment processor',
];
const errorMessages = [
  'Database connection failed',
  'Authentication failed',
  'File not found',
  'Invalid request parameters',
  'External API timeout',
  'Permission denied',
  'Memory allocation error',
  'Network connection lost',
  'Payment gateway error',
  'Unable to process request',
  'Connection timeout after 30000ms',
  'JWT token validation failed: signature mismatch',
  'Rate limit exceeded',
  'Upstream service returned 503',
  'Redis cache miss on key user:session:8f2a',
  'Unhandled promise rejection in worker thread',
  'SSL certificate verification failed',
];
const debugMessages = [
  'Request headers parsed',
  'Middleware chain started',
  'Query parameters validated',
  'Response headers set',
  'Cache lookup initiated',
  'Route handler executed',
  'Database query prepared',
  'Template rendered',
  'Session data retrieved',
  'Event emitted successfully',
];

const errorTypeMap = {
  database: ['Database connection failed', 'Database query failed: deadlock detected', 'Failed to execute query'],
  authentication: ['Authentication failed', 'JWT token validation failed: signature mismatch', 'Permission denied'],
  network: ['Network connection lost', 'External API timeout', 'Connection timeout after 30000ms', 'Upstream service returned 503'],
  file: ['File not found', 'Disk I/O error: /var/data/uploads'],
  memory: ['Memory allocation error', 'Memory heap allocation failed'],
  payment: ['Payment gateway error', 'Payment gateway rejected transaction: insufficient funds'],
};

// --- Helpers ---
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.floor(Math.random() * (max - min + 1)) + min);
const randomIp = () => `${randomInt(10, 192)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
const randomInterval = (min = 1000, max = 5000) => randomInt(min, max);

function buildRequestMeta() {
  return {
    service: randomItem(services),
    method: randomItem(httpMethods),
    endpoint: randomItem(endpoints),
    statusCode: randomItem(httpStatuses),
    responseTimeMs: randomInt(12, 4500),
    ip: randomIp(),
    requestId: `req_${Math.random().toString(36).slice(2, 11)}`,
    userId: randomInt(1, 1000),
  };
}

// --- Normal log generation (info / debug / warn, weighted) ---
let normalTimer = null;

const logTypeWeights = [
  { level: 'info', messages: infoMessages, weight: 60 },
  { level: 'debug', messages: debugMessages, weight: 30 },
  { level: 'warn', messages: warnMessages, weight: 10 },
];

function emitNormalLog() {
  let roll = Math.random() * 100;
  let selected = logTypeWeights[0];
  for (const type of logTypeWeights) {
    if (roll < type.weight) { selected = type; break; }
    roll -= type.weight;
  }
  logger.log(selected.level, randomItem(selected.messages), buildRequestMeta());

  if (normalTimer !== null) {
    normalTimer = setTimeout(emitNormalLog, randomInterval(1000, 5000));
  }
}

function startLogGeneration() {
  if (normalTimer !== null) return false;
  normalTimer = setTimeout(emitNormalLog, randomInterval(1000, 5000));
  logger.info('Normal log generation started');
  return true;
}

function stopLogGeneration() {
  if (normalTimer === null) return false;
  clearTimeout(normalTimer);
  normalTimer = null;
  logger.info('Normal log generation stopped');
  return true;
}

// --- Error generation loop ---
let errorTimer = null;

function emitErrorLog() {
  const meta = buildRequestMeta();
  const message = randomItem(errorMessages);
  logger.error(message, { ...meta, stack: new Error(message).stack });

  if (errorTimer !== null) {
    errorTimer = setTimeout(emitErrorLog, randomInterval(2000, 8000));
  }
}

function startErrorGeneration() {
  if (errorTimer !== null) return false;
  errorTimer = setTimeout(emitErrorLog, randomInterval(2000, 8000));
  logger.info('Error log generation started');
  return true;
}

function stopErrorGeneration() {
  if (errorTimer === null) return false;
  clearTimeout(errorTimer);
  errorTimer = null;
  logger.info('Error log generation stopped');
  return true;
}

// --- Express ---
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));

// 0. Recent logs — returns entries with seq > ?since (for polling)
app.get('/logs/recent', (req, res) => {
  const since = parseInt(req.query.since || '0', 10);
  const entries = since ? logBuffer.filter(e => e.seq > since) : logBuffer.slice(-50);
  res.json({ logs: entries, latest: logSeq });
});

// 1. Status
app.get('/status', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    generation: {
      normalLogs: normalTimer !== null,
      errors: errorTimer !== null,
    },
    endpoints: {
      status: 'GET  /status',
      generateError: 'POST /generate-error',
      generateBatch: 'POST /generate-batch',
      startGeneration: 'POST /start-generation',
      stopGeneration: 'POST /stop-generation',
      startErrorGeneration: 'POST /start-error-generation',
      stopErrorGeneration: 'POST /stop-error-generation',
    },
  });
});

// 2. Single error — optional body: { message?, type? }
app.post('/generate-error', (req, res) => {
  const { message, type } = req.body ?? {};
  const pool = type ? (errorTypeMap[type] ?? errorMessages) : errorMessages;
  const errorMsg = message ?? randomItem(pool);
  const meta = { ...buildRequestMeta(), triggered: true, ...(type && { errorType: type }), stack: new Error(errorMsg).stack };
  logger.error(errorMsg, meta);
  res.json({ status: 'success', message: 'Error log generated', errorMessage: errorMsg, ...(type && { errorType: type }) });
});

// 3. Batch of errors — body: { count? }
app.post('/generate-batch', (req, res) => {
  const count = Math.min(parseInt(req.body?.count ?? 10, 10), 50);
  const emitted = [];
  for (let i = 0; i < count; i++) {
    const meta = buildRequestMeta();
    const message = randomItem(errorMessages);
    logger.error(message, { ...meta, triggered: true, stack: new Error(message).stack });
    emitted.push({ level: 'error', message, service: meta.service, requestId: meta.requestId });
  }
  logger.warn(`Bulk error trigger: ${count} error logs emitted via /generate-batch`);
  res.json({ triggered: count, logs: emitted });
});

// 4. Start normal log generation
app.post('/start-generation', (_req, res) => {
  const started = startLogGeneration();
  res.json({
    status: 'success',
    message: started ? 'Normal log generation started' : 'Normal log generation already running',
    generating: true,
  });
});

// 5. Stop normal log generation
app.post('/stop-generation', (_req, res) => {
  const stopped = stopLogGeneration();
  res.json({
    status: 'success',
    message: stopped ? 'Normal log generation stopped' : 'Normal log generation was not running',
    generating: false,
  });
});

// 6. Start error generation loop
app.post('/start-error-generation', (_req, res) => {
  const started = startErrorGeneration();
  res.json({
    status: 'success',
    message: started ? 'Error generation started' : 'Error generation already running',
    generating: true,
  });
});

// 7. Stop error generation loop
app.post('/stop-error-generation', (_req, res) => {
  const stopped = stopErrorGeneration();
  res.json({
    status: 'success',
    message: stopped ? 'Error generation stopped' : 'Error generation was not running',
    generating: false,
  });
});

// Error handling middleware
app.use((err, req, res, _next) => {
  logger.error('Express error handler caught an error', { error: err.message, stack: err.stack, url: req.url, method: req.method });
  res.status(500).json({ status: 'error', message: err.message });
});

// --- Start ---
app.listen(PORT, () => {
  logger.info(`Dummy log generator running on port ${PORT}`);
  logger.info('Starting normal log and error generation automatically');
  startLogGeneration();
  startErrorGeneration();
});
