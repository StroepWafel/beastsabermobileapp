/**
 * BSLink relay: queues BeatSaver map-list JSON from phone until PC long-polls it.
 * Set PUBLIC_ORIGIN (e.g. https://relay.example.com) for pairing URLs. Use HTTPS in production.
 */
const crypto = require('crypto');
const http = require('http');
const express = require('express');

const PORT = Number(process.env.PORT) || 3848;
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 24 * 60 * 60 * 1000;
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS) || 50_000;
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES) || 26 * 1024 * 1024;

/** @type {Map<string, { token: Buffer, queue: Array<{ body: object, autoDownload: boolean }>, waiters: Set<{ res: import('express').Response, timer: NodeJS.Timeout }>, created: number }>} */
const sessions = new Map();

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

function timingSafeEqual(aBuf, bBuf) {
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function cleanupSessions() {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.created > SESSION_TTL_MS) {
      for (const w of s.waiters) {
        clearTimeout(w.timer);
        if (!w.res.headersSent) w.res.status(410).json({ error: 'Session expired' });
      }
      sessions.delete(id);
    }
  }
}

setInterval(cleanupSessions, 60_000);

const app = express();
app.disable('x-powered-by');
app.use(
  express.json({
    limit: MAX_BODY_BYTES,
    verify: (req, _res, buf) => {
      req.rawBodyLen = buf.length;
    }
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: 'bslink-relay' });
});

app.post('/v1/sessions', (_req, res) => {
  const sessionId = randomId();
  const token = randomToken();
  sessions.set(sessionId, {
    token: Buffer.from(token, 'utf8'),
    queue: [],
    waiters: new Set(),
    created: Date.now()
  });
  const basePath = `/v1/sessions/${sessionId}`;
  const pairingUrl = `${PUBLIC_ORIGIN}${basePath}/?token=${encodeURIComponent(token)}`;
  res.json({
    sessionId,
    token,
    basePath,
    pairingUrl,
    publicOrigin: PUBLIC_ORIGIN
  });
});

function getSession(sessionId) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return s;
}

function notifyWaiters(session) {
  while (session.queue.length > 0 && session.waiters.size > 0) {
    const item = session.queue.shift();
    const waiter = [...session.waiters][0];
    session.waiters.delete(waiter);
    clearTimeout(waiter.timer);
    if (!waiter.res.headersSent) {
      waiter.res.json({ ...item.body, autoDownload: item.autoDownload });
    }
  }
}

app.post('/v1/sessions/:sessionId/import', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown or expired session' });
    return;
  }
  const token = req.query.token || req.headers['x-beastsaber-token'];
  if (!token || !timingSafeEqual(Buffer.from(String(token), 'utf8'), session.token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const body = req.body;
  if (!body || body.format !== 'bsaber-map-list' || !Array.isArray(body.maps)) {
    res.status(400).json({ error: 'Invalid body: expected bsaber-map-list with maps[]' });
    return;
  }
  const autoDownload =
    req.query.autoDownload === '1' ||
    req.query.autoDownload === 'true' ||
    req.query.autoDownload === 'yes';
  session.queue.push({ body, autoDownload });
  notifyWaiters(session);
  res.json({ ok: true, maps: body.maps.length });
});

app.get('/v1/sessions/:sessionId/wait', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown or expired session' });
    return;
  }
  const token = req.query.token || req.headers['x-beastsaber-token'];
  if (!token || !timingSafeEqual(Buffer.from(String(token), 'utf8'), session.token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (session.queue.length > 0) {
    const item = session.queue.shift();
    res.json({ ...item.body, autoDownload: item.autoDownload });
    return;
  }

  const waiter = { res, timer: null };
  waiter.timer = setTimeout(() => {
    session.waiters.delete(waiter);
    if (!res.headersSent) res.status(204).end();
  }, WAIT_TIMEOUT_MS);
  session.waiters.add(waiter);

  req.on('close', () => {
    session.waiters.delete(waiter);
    clearTimeout(waiter.timer);
  });
});

app.delete('/v1/sessions/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Unknown session' });
    return;
  }
  const token = req.query.token || req.headers['x-beastsaber-token'];
  if (!token || !timingSafeEqual(Buffer.from(String(token), 'utf8'), session.token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  for (const w of session.waiters) {
    clearTimeout(w.timer);
    if (!w.res.headersSent) w.res.status(410).end();
  }
  sessions.delete(sessionId);
  res.json({ ok: true });
});

const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  if (process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.log(`bslink-relay listening on ${PORT} (PUBLIC_ORIGIN=${PUBLIC_ORIGIN})`);
  }
});
