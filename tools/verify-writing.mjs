import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const profile = await mkdtemp(join(tmpdir(), 'writing-edge-'));
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
  if (!path.startsWith(root) || !path.includes('index.html') && !['.js', '.css', '.svg', '.pdf'].includes(extname(path))) { res.writeHead(404).end(); return; }
  try {
    const data = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const edge = spawn(edgePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, `http://127.0.0.1:${port}/writing/`], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const tabs = await fetch('http://127.0.0.1:9333/json').then(response => response.json());
      target = tabs.find(tab => tab.type === 'page')?.webSocketDebuggerUrl;
      if (target) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!target) throw new Error('Could not connect to headless Edge');
  ws = new WebSocket(target);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, message => message.error ? reject(Error(message.error.message)) : resolve(message.result));
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  const navigate = async path => {
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${path}` });
    await new Promise(resolve => setTimeout(resolve, 850));
  };
  const waitFor = async expression => {
    for (let i = 0; i < 30; i++) {
      if (await evaluate(expression)) return true;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  };
  const assert = (condition, label) => { if (!condition) throw new Error(label); console.log('PASS', label); };
  const screenshot = async name => {
    const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(join(root, 'previews', name), Buffer.from(image.data, 'base64'));
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('/writing/');
  assert(await evaluate("!document.querySelector('#writing-empty').hidden && document.querySelectorAll('.writing-card').length === 0"), 'public empty state');
  await screenshot('writing-empty.png');
  await navigate('/writing/?preview=1');
  assert(await evaluate("document.querySelectorAll('.writing-featured-card').length === 1 && document.querySelectorAll('.writing-card').length === 3"), 'featured and grid preview');
  await screenshot('writing-desktop.png');
  assert(await evaluate("[...document.querySelectorAll('.writing-action')].every(x => x.tagName === 'SPAN')"), 'sample links inactive');
  await send('Runtime.evaluate', { expression: "document.querySelectorAll('.writing-filter')[2].click()" });
  assert(await evaluate("document.querySelectorAll('.writing-card').length === 1 && document.querySelector('.writing-filter[aria-pressed=true]').textContent === 'LLM Inference'"), 'topic filter');
  await new Promise(resolve => setTimeout(resolve, 220));
  await screenshot('writing-selected-topic.png');
  await navigate('/writing/?preview=1&topic=Deployment');
  assert(await evaluate("!document.querySelector('#writing-no-results').hidden"), 'no-results state');
  await screenshot('writing-no-results.png');
  await send('Runtime.evaluate', { expression: "document.querySelector('#writing-clear-filters').click()" });
  assert(await evaluate("document.querySelectorAll('.writing-card').length === 3"), 'clear filters');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/writing/?preview=1');
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile has no horizontal overflow');
  await screenshot('writing-mobile.png');
  await send('Runtime.evaluate', { expression: "document.querySelector('.writing-menu-button').click()" });
  assert(await evaluate("!document.querySelector('#writing-mobile-nav').hidden && document.querySelector('.writing-menu-button').getAttribute('aria-expanded') === 'true'"), 'mobile navigation');
  await navigate('/');
  assert(await waitFor("!!document.querySelector('.latest-writing') && !!document.querySelector('a[href=\"/writing\"]')"), 'homepage connection');
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('/');
  const navFits = await evaluate("(() => { const w=document.querySelector('.site-wordmark').getBoundingClientRect(), n=document.querySelector('#desktop-nav').getBoundingClientRect(), r=document.querySelector('.nav-resume-btn').getBoundingClientRect(); return {wordmarkRight:w.right,navLeft:n.left,navRight:n.right,resumeLeft:r.left,viewport:innerWidth}; })()");
  console.log('Homepage navigation at 1100px:', navFits);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('/?preview=1');
  assert(await waitFor("document.querySelectorAll('.latest-writing-item').length === 3"), 'homepage sample preview');
  await screenshot('writing-home-preview.png');
  console.log('Writing checks complete.');
} finally {
  ws?.close();
  edge.kill();
  server.close();
  if (!profile.startsWith(resolve(tmpdir()) + sep) || !profile.split(sep).at(-1).startsWith('writing-edge-')) throw new Error('Unexpected browser profile path');
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}
