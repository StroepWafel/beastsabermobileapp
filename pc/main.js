const { app, BrowserWindow, ipcMain, dialog, Menu, screen } = require('electron');
const path = require('path');

/** True when running from source (`npm run dev` / `npm start`), false in packaged builds. */
const isDev = !app.isPackaged;

function buildDevMenu() {
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}
const fsSync = require('fs');
const fs = require('fs/promises');

const windowIconPath = path.join(__dirname, 'build', 'icon.png');
const http = require('http');
const express = require('express');

let mainWindow;
let lanServer = null;
let lanToken = '';
let lanPort = 3847;
let lanBaseUrl = '';

/** @type {AbortController | null} */
let relayAbort = null;
/** @type {{ baseUrl: string, sessionId: string, token: string, pairingUrl: string } | null} */
let relaySession = null;

function settingsFilePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

const defaultSettings = {
  outDir: null,
  extractZips: false,
  deleteZipsAfterExtract: false,
  lanAllowAutoDownload: false,
  relayAllowAutoDownload: false,
  plTitle: 'My list',
  plAuthor: 'BeastSaber',
  /** Public base URL of the intermediary relay (HTTPS). Empty in saved settings means use built-in default in renderer. */
  relayUrl: 'https://bsrelay.stroepwafel.au',
  /** @type {{ x: number, y: number, width: number, height: number, isMaximized?: boolean, isFullScreen?: boolean } | null} */
  windowState: null
};

const MIN_W = 720;
const MIN_H = 560;
const DEFAULT_W = 1040;
const DEFAULT_H = 800;

function boundsIntersectWorkArea(bounds) {
  const { x, y, width, height } = bounds;
  const right = x + width;
  const bottom = y + height;
  for (const d of screen.getAllDisplays()) {
    const w = d.workArea;
    const wr = w.x + w.width;
    const wb = w.y + w.height;
    if (right > w.x && x < wr && bottom > w.y && y < wb) return true;
  }
  return false;
}

function normalizeSavedWindowState(ws) {
  if (!ws || typeof ws !== 'object') return null;
  const w = Number(ws.width);
  const h = Number(ws.height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  const width = Math.max(MIN_W, Math.min(w, 100000));
  const height = Math.max(MIN_H, Math.min(h, 100000));
  const x = Number(ws.x);
  const y = Number(ws.y);
  const hasPos = Number.isFinite(x) && Number.isFinite(y);
  const bounds = hasPos ? { x, y, width, height } : { x: 0, y: 0, width, height };
  if (hasPos && !boundsIntersectWorkArea(bounds)) return null;
  return {
    x: hasPos ? x : undefined,
    y: hasPos ? y : undefined,
    width,
    height,
    isMaximized: Boolean(ws.isMaximized),
    isFullScreen: Boolean(ws.isFullScreen)
  };
}

function saveMainWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isMaximized = mainWindow.isMaximized();
  const isFullScreen = mainWindow.isFullScreen();
  const bounds =
    isFullScreen || isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
  writeSettingsSync({
    windowState: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
      isFullScreen
    }
  });
}

function readSettingsSync() {
  try {
    const raw = fsSync.readFileSync(settingsFilePath(), 'utf8');
    const parsed = JSON.parse(raw);
    const merged = { ...defaultSettings, ...parsed };
    if (parsed.relayUrl === undefined || parsed.relayUrl === null || String(parsed.relayUrl).trim() === '') {
      merged.relayUrl = defaultSettings.relayUrl;
    }
    return merged;
  } catch {
    return { ...defaultSettings };
  }
}

function writeSettingsSync(patch) {
  const next = { ...readSettingsSync(), ...patch };
  const dir = path.dirname(settingsFilePath());
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
  fsSync.writeFileSync(settingsFilePath(), JSON.stringify(next, null, 2), 'utf8');
}

ipcMain.handle('settings-get', () => readSettingsSync());
ipcMain.handle('settings-set', (_e, patch) => {
  writeSettingsSync(patch);
  return true;
});

function createWindow() {
  const ws = normalizeSavedWindowState(readSettingsSync().windowState);
  const winOpts = {
    width: ws?.width ?? DEFAULT_W,
    height: ws?.height ?? DEFAULT_H,
    minWidth: MIN_W,
    minHeight: MIN_H,
    autoHideMenuBar: true,
    show: false,
    icon: fsSync.existsSync(windowIconPath) ? windowIconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (ws && typeof ws.x === 'number' && typeof ws.y === 'number') {
    winOpts.x = ws.x;
    winOpts.y = ws.y;
  }
  mainWindow = new BrowserWindow(winOpts);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (ws?.isFullScreen) mainWindow.setFullScreen(true);
    else if (ws?.isMaximized) mainWindow.maximize();
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('close', () => {
    saveMainWindowState();
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.once('did-finish-load', () => {
    startLanServer().catch((err) => {
      const msg = err?.message || String(err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lan-event', {
          type: 'start-failed',
          message: msg
        });
      }
    });
  });
}

function parseExport(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  if (!data || data.format !== 'bsaber-map-list' || !Array.isArray(data.maps)) {
    throw new Error('Invalid file: expected format bsaber-map-list with maps[]');
  }
  return data;
}

ipcMain.handle('select-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});

ipcMain.handle('import-json-path', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const text = await fs.readFile(r.filePaths[0], 'utf8');
  return parseExport(text);
});

ipcMain.handle('load-json-text', async (_e, text) => parseExport(text));

/** Generate LAN pairing QR in main process (reliable vs require() in preload when packaged). */
ipcMain.handle('qr-data-url', async (_e, text) => {
  const QRCode = require('qrcode');
  return QRCode.toDataURL(String(text), { margin: 1, width: 220, type: 'png' });
});


async function extractMapZip(zipPath, outDir, baseFolderName) {
  const extract = require('extract-zip');
  const extractDir = path.join(outDir, baseFolderName);
  await fs.mkdir(extractDir, { recursive: true });
  const absDir = path.resolve(extractDir);
  await extract(zipPath, { dir: absDir });
  return extractDir;
}

ipcMain.handle('download-maps', async (_e, payload) => {
  const {
    outDir,
    maps,
    concurrency = 4,
    extractZips = false,
    deleteZipsAfterExtract = false
  } = payload;
  if (!outDir || !Array.isArray(maps)) throw new Error('Missing outDir or maps');
  const results = [];
  const safe = (s) => String(s).replace(/[<>:"/\\|?*]+/g, '_').slice(0, 120);

  for (let i = 0; i < maps.length; i += concurrency) {
    const batch = maps.slice(i, i + concurrency);
    const part = await Promise.all(
      batch.map(async (m) => {
        const name = `${safe(m.key)} - ${safe(m.songName)}.zip`;
        const dest = path.join(outDir, name);
        const baseFolderName = path.basename(dest, '.zip');
        try {
          const res = await fetch(m.downloadURL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = Buffer.from(await res.arrayBuffer());
          await fs.writeFile(dest, buf);
          const row = { key: m.key, ok: true, path: dest };
          if (extractZips) {
            try {
              row.extractedTo = await extractMapZip(dest, outDir, baseFolderName);
              if (deleteZipsAfterExtract) {
                await fs.unlink(dest);
                row.zipDeleted = true;
              }
            } catch (ex) {
              row.extractError = String(ex.message || ex);
            }
          }
          return row;
        } catch (e) {
          return { key: m.key, ok: false, error: String(e.message || e) };
        }
      })
    );
    results.push(...part);
    if (mainWindow) {
      mainWindow.webContents.send('lan-event', {
        type: 'download-progress',
        done: Math.min(i + batch.length, maps.length),
        total: maps.length
      });
    }
  }
  return results;
});

ipcMain.handle('write-bplist', async (_e, payload) => {
  const { outDir, maps, title, author } = payload;
  const playlist = {
    playlistTitle: title || 'BeastSaber export',
    playlistAuthor: author || 'BeastSaber PC',
    image: '',
    songs: maps.map((m) => ({
      key: m.key,
      hash: m.hash,
      songName: m.songName,
      levelAuthorName: m.levelAuthorName || ''
    }))
  };
  const dest = path.join(outDir, 'playlist.bplist');
  await fs.writeFile(dest, JSON.stringify(playlist, null, 2), 'utf8');
  return dest;
});

function randomToken() {
  return require('crypto').randomBytes(12).toString('hex');
}

function getLanIps() {
  const nets = require('os').networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const fam = net.family;
      const isV4 = fam === 'IPv4' || fam === 4;
      if (isV4 && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function getLanNetworkBaseUrl() {
  const ips = getLanIps();
  const primary = ips[0] || '127.0.0.1';
  return `http://${primary}:${lanPort}`;
}

function sendLanStartedToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const base = lanBaseUrl || getLanNetworkBaseUrl();
  mainWindow.webContents.send('lan-event', {
    type: 'started',
    port: lanPort,
    token: lanToken,
    baseUrl: base
  });
}

async function startLanServer() {
  if (lanServer) {
    const ips = getLanIps();
    const baseUrl = lanBaseUrl || getLanNetworkBaseUrl();
    sendLanStartedToRenderer();
    return {
      running: true,
      port: lanPort,
      token: lanToken,
      baseUrl,
      url: `http://127.0.0.1:${lanPort}`,
      ips
    };
  }
  try {
    lanToken = randomToken();
    const exp = express();
    exp.use(express.json({ limit: '25mb' }));

    exp.post('/import', (req, res) => {
      const token = req.query.token || req.headers['x-beastsaber-token'];
      if (!token || token !== lanToken) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      try {
        const data = parseExport(req.body);
        const autoDownload =
          req.query.autoDownload === '1' ||
          req.query.autoDownload === 'true' ||
          req.query.autoDownload === 'yes';
        if (mainWindow) {
          mainWindow.webContents.send('lan-event', {
            type: 'import',
            data,
            autoDownload,
            source: 'lan'
          });
        }
        res.json({ ok: true, maps: data.maps.length });
      } catch (e) {
        res.status(400).json({ error: String(e.message || e) });
      }
    });

    exp.get('/health', (_req, res) => {
      res.json({ ok: true, app: 'beastsaber-pc' });
    });

    const server = http.createServer(exp);
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen(lanPort, '0.0.0.0', () => resolve());
    });
    lanServer = server;

    const ips = getLanIps();
    const base = getLanNetworkBaseUrl();
    lanBaseUrl = base;

    sendLanStartedToRenderer();

    return { running: true, port: lanPort, token: lanToken, baseUrl: base, ips };
  } catch (e) {
    const msg =
      e && e.code === 'EADDRINUSE'
        ? `Port ${lanPort} is already in use. Close the other app or change the port in the PC app source.`
        : String(e.message || e);
    throw new Error(msg);
  }
}

async function stopRelayInternal() {
  if (relayAbort) {
    relayAbort.abort();
    relayAbort = null;
  }
  const sess = relaySession;
  relaySession = null;
  if (sess) {
    try {
      const u = `${sess.baseUrl}/v1/sessions/${sess.sessionId}?token=${encodeURIComponent(sess.token)}`;
      await fetch(u, { method: 'DELETE' });
    } catch (_) {
      /* ignore */
    }
  }
}

function runRelayPoll(signal) {
  return (async () => {
    while (!signal.aborted) {
      const sess = relaySession;
      if (!sess) break;
      try {
        const url = `${sess.baseUrl}/v1/sessions/${sess.sessionId}/wait?token=${encodeURIComponent(sess.token)}`;
        const res = await fetch(url, { signal });
        if (signal.aborted) break;
        if (res.status === 204) continue;
        if (!res.ok) throw new Error(`wait HTTP ${res.status}`);
        const raw = await res.json();
        const autoDownload = raw.autoDownload === true || raw.autoDownload === 'true';
        const copy = { ...raw };
        delete copy.autoDownload;
        const data = parseExport(copy);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('lan-event', {
            type: 'import',
            data,
            autoDownload,
            source: 'relay'
          });
        }
      } catch (e) {
        if (signal.aborted) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
}

ipcMain.handle('relay-start', async (_e, relayUrl) => {
  await stopRelayInternal();
  const base = String(relayUrl || '')
    .trim()
    .replace(/\/$/, '');
  if (!base) {
    throw new Error('Enter a relay URL (e.g. https://your-relay.example.com or http://127.0.0.1:3848)');
  }
  let r;
  try {
    r = await fetch(`${base}/v1/sessions`, { method: 'POST' });
  } catch (e) {
    throw new Error(`Cannot reach relay: ${e.message || e}`);
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Relay returned ${r.status}: ${t.slice(0, 240)}`);
  }
  const j = await r.json();
  relaySession = {
    baseUrl: base,
    sessionId: j.sessionId,
    token: j.token,
    pairingUrl: j.pairingUrl || `${base}/v1/sessions/${j.sessionId}/?token=${encodeURIComponent(j.token)}`
  };
  relayAbort = new AbortController();
  runRelayPoll(relayAbort.signal).catch(() => {});
  writeSettingsSync({ relayUrl: base });
  return {
    pairingUrl: relaySession.pairingUrl,
    sessionId: relaySession.sessionId,
    token: relaySession.token,
    baseUrl: base
  };
});

ipcMain.handle('relay-stop', async () => {
  await stopRelayInternal();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('lan-event', { type: 'relay-stopped' });
  }
  return { running: false };
});

ipcMain.handle('lan-start', () => startLanServer());

ipcMain.handle('lan-stop', async () => {
  if (lanServer) {
    await new Promise((resolve) => lanServer.close(() => resolve()));
    lanServer = null;
    lanBaseUrl = '';
  }
  if (mainWindow) {
    mainWindow.webContents.send('lan-event', { type: 'stopped' });
  }
  return { running: false };
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(isDev ? buildDevMenu() : null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopRelayInternal().catch(() => {});
});

app.on('window-all-closed', () => {
  stopRelayInternal().catch(() => {});
  if (lanServer) {
    lanServer.close();
    lanServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
