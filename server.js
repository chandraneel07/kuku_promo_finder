const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const showService = require('./src/services/show_service');
const reviewService = require('./src/services/review_service');
const evalService = require('./src/services/eval_service');
const exportService = require('./src/services/export_service');
const pipelineRunner = require('./src/pipeline/runner');
const factory = require('./src/llm/factory');

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8'
};

// In-memory active runs registry for live progress tracking
const activeRuns = new Map();

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8', filename = null) {
  const headers = {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  };
  if (filename) {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }
  res.writeHead(statusCode, headers);
  res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 50 * 1024 * 1024) { // 50MB limit for screenplays
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ text: body });
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  try {
    // ==========================================
    // REST API ROUTES
    // ==========================================

    // 1. GET /api/shows - List all shows
    if (method === 'GET' && pathname === '/api/shows') {
      const shows = showService.listShows();
      return sendJSON(res, 200, { shows });
    }

    // 2. GET /api/shows/compare - Cross-show comparison table
    if (method === 'GET' && pathname === '/api/shows/compare') {
      const comparison = showService.compareShows();
      return sendJSON(res, 200, { comparison });
    }

    // 3. POST /api/shows/preview - Preview screenplay text
    if (method === 'POST' && pathname === '/api/shows/preview') {
      const body = await parseBody(req);
      const preview = showService.previewScreenplays(body.text || '');
      return sendJSON(res, 200, preview);
    }

    // 4. POST /api/shows - Create new show
    if (method === 'POST' && pathname === '/api/shows') {
      const body = await parseBody(req);
      const created = showService.createShow(body);
      return sendJSON(res, 201, created);
    }

    // 5. GET /api/shows/:id - Get show details, promos, reviews
    const showMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && showMatch) {
      const showId = showMatch[1];
      const data = showService.getShow(showId);
      if (!data) return sendJSON(res, 404, { error: 'Show not found' });
      return sendJSON(res, 200, data);
    }

    // 6. POST /api/shows/:id/run - Trigger pipeline run
    const runMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/run$/);
    if (method === 'POST' && runMatch) {
      const showId = runMatch[1];
      const body = await parseBody(req);

      // Check if show exists
      const showMeta = showService.getShow(showId);
      if (!showMeta) return sendJSON(res, 404, { error: 'Show not found' });

      // Start run asynchronously
      const runId = `run_${Date.now()}`;
      activeRuns.set(showId, {
        showId,
        runId,
        status: 'running',
        stage: 'Initializing',
        pct: 5,
        logs: [],
        tokens: { input: 0, output: 0, cost: 0 },
        started_at: new Date().toISOString()
      });

      // Background task execution
      pipelineRunner.runShowPipeline(showId, body.options || {}, (progressEvent) => {
        const current = activeRuns.get(showId) || {};
        if (progressEvent.type === 'log') {
          current.logs = current.logs || [];
          current.logs.push(progressEvent);
          if (current.logs.length > 100) current.logs.shift();
        } else {
          Object.assign(current, progressEvent);
        }
        activeRuns.set(showId, current);
      }).then(result => {
        const current = activeRuns.get(showId) || {};
        current.status = 'completed';
        current.pct = 100;
        current.result = {
          run_id: result.run_id,
          promos_count: result.promos.length,
          avg_score: result.meta?.avg_score
        };
        activeRuns.set(showId, current);
      }).catch(err => {
        const current = activeRuns.get(showId) || {};
        current.status = 'error';
        current.error = err.message;
        activeRuns.set(showId, current);
      });

      return sendJSON(res, 202, { message: 'Pipeline run initiated', showId, runId });
    }

    // 7. GET /api/shows/:id/run/active - Poll active run progress
    const activeRunMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/run\/active$/);
    if (method === 'GET' && activeRunMatch) {
      const showId = activeRunMatch[1];
      const status = activeRuns.get(showId) || { status: 'idle', pct: 0, stage: 'Idle' };
      return sendJSON(res, 200, status);
    }

    // 8. POST /api/shows/:id/review - Human review update (approve/reject/nudge/note)
    const reviewMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/review$/);
    if (method === 'POST' && reviewMatch) {
      const showId = reviewMatch[1];
      const body = await parseBody(req);
      if (!body.promo_id) return sendJSON(res, 400, { error: 'promo_id is required' });

      const updated = reviewService.saveReview(showId, body.promo_id, body);
      return sendJSON(res, 200, { success: true, promo_id: body.promo_id, review: updated });
    }

    // 9. GET /api/shows/:id/eval - Run benchmarks vs gold set
    const evalGetMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/eval$/);
    if (method === 'GET' && evalGetMatch) {
      const showId = evalGetMatch[1];
      const showData = showService.getShow(showId);
      if (!showData) return sendJSON(res, 404, { error: 'Show not found' });

      const evalResult = evalService.evaluatePromos(showId, showData.promos || []);
      const goldSet = evalService.getGoldSet(showId);
      return sendJSON(res, 200, { evaluation: evalResult, gold_set: goldSet });
    }

    // 10. POST /api/shows/:id/eval - Update gold set
    if (method === 'POST' && evalGetMatch) {
      const showId = evalGetMatch[1];
      const body = await parseBody(req);
      const saved = evalService.saveGoldSet(showId, body);
      return sendJSON(res, 200, { success: true, gold_set: saved });
    }

    // 11. GET /api/shows/:id/runs/compare - Compare two runs
    const compareRunsMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/runs\/compare$/);
    if (method === 'GET' && compareRunsMatch) {
      const showId = compareRunsMatch[1];
      const runA = parsedUrl.query.runA;
      const runB = parsedUrl.query.runB;
      if (!runA || !runB) return sendJSON(res, 400, { error: 'runA and runB query parameters are required' });

      const diff = showService.compareRuns(showId, runA, runB);
      return sendJSON(res, 200, diff);
    }

    // 12. GET /api/shows/:id/export - Export CSV, JSON, EDL
    const exportMatch = pathname.match(/^\/api\/shows\/([a-zA-Z0-9_-]+)\/export$/);
    if (method === 'GET' && exportMatch) {
      const showId = exportMatch[1];
      const format = (parsedUrl.query.format || 'csv').toLowerCase();
      const approvedOnly = parsedUrl.query.approved === 'true';

      const showData = showService.getShow(showId);
      if (!showData) return sendJSON(res, 404, { error: 'Show not found' });

      const promos = showData.promos || [];
      const reviews = showData.reviews || {};
      const title = showData.show?.title || showId;

      if (format === 'json') {
        const jsonOut = exportService.exportJSON(promos, approvedOnly, reviews);
        return sendText(res, 200, jsonOut, 'application/json', `${showId}_promos.json`);
      } else if (format === 'edl') {
        const edlOut = exportService.exportEDL(promos, approvedOnly, reviews, title);
        return sendText(res, 200, edlOut, 'text/plain', `${showId}_promos.edl`);
      } else {
        const csvOut = exportService.exportCSV(promos, approvedOnly, reviews);
        return sendText(res, 200, csvOut, 'text/csv', `${showId}_promos.csv`);
      }
    }

    // 13. GET & POST /api/settings - Read or write LLM and pipeline settings
    if (pathname === '/api/settings') {
      if (method === 'GET') {
        const settings = factory.getSettings();
        return sendJSON(res, 200, settings);
      } else if (method === 'POST') {
        const body = await parseBody(req);
        const ok = factory.saveSettings(body);
        return sendJSON(res, ok ? 200 : 500, { success: ok });
      }
    }

    // 14. POST /api/settings/test-connection - Test provider credentials
    if (method === 'POST' && pathname === '/api/settings/test-connection') {
      const body = await parseBody(req);
      const testRes = await factory.testConnection(body.provider || 'mock', body.config || {});
      return sendJSON(res, 200, testRes);
    }

    // 15. GET & POST /api/prompts - Read or edit prompt templates
    if (pathname === '/api/prompts') {
      const promptsDir = path.join(BASE_DIR, 'prompts');
      if (method === 'GET') {
        const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md'));
        const prompts = {};
        for (const f of files) {
          prompts[f] = fs.readFileSync(path.join(promptsDir, f), 'utf8');
        }
        return sendJSON(res, 200, { prompts });
      } else if (method === 'POST') {
        const body = await parseBody(req);
        if (body.filename && body.content) {
          const safeName = path.basename(body.filename);
          fs.writeFileSync(path.join(promptsDir, safeName), body.content, 'utf8');
          return sendJSON(res, 200, { success: true, filename: safeName });
        }
        return sendJSON(res, 400, { error: 'filename and content required' });
      }
    }

    // ==========================================
    // STATIC FILE & SPA ROUTING
    // ==========================================
    let reqPath = pathname;

    // SPA client-side routes rewrite to web/index.html
    const isSpaRoute = reqPath === '/' || 
                       reqPath === '' || 
                       reqPath.startsWith('/show/') || 
                       reqPath === '/settings' || 
                       reqPath === '/eval' || 
                       reqPath === '/compare';

    if (isSpaRoute) {
      reqPath = '/web/index.html';
    } else if (reqPath.startsWith('/data/')) {
      // Map data requests directly
      reqPath = reqPath;
    }

    const filePath = path.join(BASE_DIR, reqPath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to web/index.html for any unhandled html routes
        const fallbackPath = path.join(BASE_DIR, 'web', 'index.html');
        if (fs.existsSync(fallbackPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          fs.createReadStream(fallbackPath).pipe(res);
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + pathname);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });

      fs.createReadStream(filePath).pipe(res);
    });
  } catch (serverErr) {
    console.error('[Server Error]', serverErr);
    sendJSON(res, 500, { error: serverErr.message });
  }
});

server.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`  Kuku MicroPromo Discovery Studio running on http://localhost:${PORT}`);
  console.log(`  - Active Provider: ${factory.getSettings().active_provider}`);
  console.log(`  - Multi-Show Library: http://localhost:${PORT}/`);
  console.log(`  - Seeded Show: http://localhost:${PORT}/show/show_001_duke`);
  console.log(`================================================================`);
});
