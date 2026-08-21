export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const FIXTURE_DIR = '/demo-data';

const FIXTURE_MAP = {
  '/api/config': 'config.json',
  '/api/holdings': 'holdings.json',
  '/api/portfolio': 'portfolio.json',
  '/api/system/status': 'system-status.json',
  '/api/watchlist': 'watchlist.json',
  '/api/accounts': 'accounts.json',
  '/api/accounts/active': 'accounts-active.json',
  '/api/signals': 'signals.json',
  '/api/tax': 'tax.json',
  '/api/intelligence': 'intelligence.json',
  '/api/price-alerts': 'price-alerts.json',
};

const TRACKED_ASSETS_RE = /^\/api\/accounts\/[^/]+\/tracked-assets$/;

function serveFixture(filename) {
  return fetch(`${FIXTURE_DIR}/${filename}`);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function serveSchedulerLatest(type) {
  const filename = type === 'weekly' ? 'scheduler-weekly.json' : 'scheduler-daily.json';
  const res = await serveFixture(filename);
  const body = await res.json();
  return jsonResponse(body, body.status === 'error' ? 404 : 200);
}

async function serveNews(params) {
  const res = await serveFixture('news.json');
  const body = await res.json();
  const ticker = params.get('ticker');
  const category = params.get('category');
  let articles = body.data.articles;
  if (ticker && ticker !== 'all') articles = articles.filter((a) => a.tickers?.includes(ticker));
  if (category && category !== 'all') articles = articles.filter((a) => a.category === category);
  return jsonResponse({ ...body, data: { ...body.data, articles, total: articles.length } });
}

export function demoFetch(url, init) {
  if (!DEMO_MODE) return fetch(url, init);

  const [path, queryString] = url.split('?');
  const params = new URLSearchParams(queryString ?? '');

  if (path === '/api/demo/status') return Promise.resolve(jsonResponse({ isDemoMode: true }));
  if (path === '/api/scheduler/latest') return serveSchedulerLatest(params.get('type'));
  if (path === '/api/news') return serveNews(params);
  if (TRACKED_ASSETS_RE.test(path)) return serveFixture('tracked-assets.json');

  const filename = FIXTURE_MAP[path];
  if (filename) return serveFixture(filename);

  return Promise.resolve(
    jsonResponse({ status: 'error', message: `demoFetch: no fixture mapped for ${path}` }, 404)
  );
}
