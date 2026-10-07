// Optional browser check, using Node 22+ and a local Chrome (no npm packages).
// Start Chrome headlessly with --remote-debugging-port=9223 and a dedicated
// --user-data-dir, then run: node tools/verify-dot-art.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map(), errors = [], results = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (!message.id) return;
  const task = pending.get(message.id);
  pending.delete(message.id);
  message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
});
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, value) {
  assert.ok(value, name);
  results.push(name);
  console.log(`PASS ${name}`);
}
async function load(width = 1440, height = 1180, mobile = false) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const url = pathToFileURL(path.join(root, 'dot-art.html')).href + `?check=${sequence}`;
  await call('Page.navigate', { url });
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && !!document.querySelector('[data-dot-ready]')`)) return;
    await pause(30);
  }
  throw new Error('Portrait did not initialize.');
}
async function screenshot(name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(root, 'previews', name), Buffer.from(data, 'base64'));
}
const count = () => evaluate(`document.querySelector('[data-dot-layer]').children.length`);
const transformed = () => evaluate(`document.querySelectorAll('[data-dot-layer] [transform]').length`);
const frameCount = () => evaluate('window.__frames.calls');
const idle = () => evaluate('window.__frames.pending.size === 0');
const geometry = () => evaluate(`JSON.stringify([...document.querySelector('[data-dot-layer]').children].map(n => [n.getAttribute('cx'),n.getAttribute('cy'),n.getAttribute('rx'),n.getAttribute('ry'),n.getAttribute('opacity'),n.getAttribute('transform')]))`);
async function position(x, y) {
  return evaluate(`(() => { const m = document.querySelector('[data-dot-svg]').getScreenCTM(); const p = new DOMPoint(${x},${y}).matrixTransform(m); return {x:p.x,y:p.y} })()`);
}

try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__frames = { pending: new Set(), calls: 0 };
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = fn => { const id = request(t => { __frames.pending.delete(id); __frames.calls++; fn(t) }); __frames.pending.add(id); return id };
    window.cancelAnimationFrame = id => { __frames.pending.delete(id); cancel(id) };
    const createURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__downloadXML = blob.text(); return createURL(blob) };
  ` });
  await call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: path.join(root, 'scratch', 'dot-downloads') });
  await load();
  check('Desktop density is 5,200 marks', await count() === 5200);
  check('Entrance begins with hidden marks', await evaluate(`!!document.querySelector('[data-dot-layer] [opacity="0"]')`));
  await evaluate(`document.querySelector('[data-dot-download]').click()`);
  const exportCheck = () => evaluate(`(async () => {
    const xml = await window.__downloadXML;
    const doc = new DOMParser().parseFromString(xml, 'image/svg+xml');
    return !doc.querySelector('parsererror,script,image,[transform],ellipse[opacity="0"]') &&
      doc.querySelectorAll('ellipse').length === document.querySelector('[data-dot-layer]').children.length &&
      [...doc.querySelectorAll('[fill^="url"]')].every(n => doc.getElementById(n.getAttribute('fill').slice(5,-1))) &&
      !!doc.querySelector('title') && !!doc.querySelector('desc');
  })()`);
  check('Export during entrance is complete and self contained', await exportCheck());
  await pause(1450);
  check('Entrance completes and animation loop stops', await idle() && !await evaluate(`!!document.querySelector('[data-dot-layer] [opacity="0"]')`));
  const original = await geometry();
  const calls = await frameCount();
  await pause(220);
  check('No work runs while idle', calls === await frameCount());
  await screenshot('dot-art-desktop.png');
  check('The removed ribbon area contains no dots', await evaluate(`![...document.querySelector('[data-dot-layer]').children].some(n => +n.getAttribute('cx') < 220 && +n.getAttribute('cy') < 410)`));
  for (const theme of ['black', 'gray', 'silver']) {
    await evaluate(`document.querySelector('[data-dot-theme="${theme}"]').click()`);
    check(`${theme}: color switch preserves geometry and idle state`, original === await geometry() && await idle());
    check(`${theme}: selected control is accessible`, await evaluate(`document.querySelectorAll('[data-dot-theme][aria-pressed="true"]').length === 1 && document.querySelector('[data-dot-theme="${theme}"]').getAttribute('aria-pressed') === 'true'`));
    await evaluate(`document.querySelector('[data-dot-download]').click()`);
    check(`${theme}: exported SVG is complete`, await exportCheck());
    check(`${theme}: export preserves the selected colors`, await evaluate(`(async () => {
      const doc = new DOMParser().parseFromString(await window.__downloadXML, 'image/svg+xml');
      const svg = document.querySelector('[data-dot-svg]');
      return doc.querySelector('rect').getAttribute('fill') === svg.querySelector('rect').getAttribute('fill') &&
        [...doc.querySelectorAll('stop')].every((stop, i) => stop.getAttribute('stop-color') === svg.querySelectorAll('stop')[i].getAttribute('stop-color'));
    })()`));
    if (theme === 'black') check('Black version uses only black paint', await evaluate(`[...document.querySelectorAll('[data-dot-svg] stop')].every(n => n.getAttribute('stop-color').toLowerCase() === '#000000')`));
    await screenshot(`dot-art-${theme}.png`);
  }
  await evaluate(`document.querySelector('[data-dot-theme="earth"]').click()`);

  const p = await position(405, 245);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  await pause(180);
  const affected = await transformed();
  check('Hover changes a localized subset of dots', affected > 0 && affected < 1300);
  await evaluate(`document.querySelector('[data-dot-download]').click()`);
  check('Export during interaction removes every displacement', await exportCheck());
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 20, y: 20 });
  await pause(800);
  check('Dots return exactly to their resting geometry', original === await geometry() && await idle());

  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...p, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...p, button: 'left', clickCount: 1 });
  await pause(120);
  check('A click creates a localized ripple', await transformed() > 0);
  await pause(1000);
  check('Ripple settles without an idle loop', await transformed() === 0 && await idle());

  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  await pause(550);
  await evaluate(`document.querySelector('[data-dot-reset]').click()`);
  check('Reset clears a settled hover and stops the loop', await transformed() === 0 && await idle());
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, x: p.x+2 });
  await pause(150);
  await evaluate(`document.querySelector('.dot-exhibit').style.marginBottom='1500px'; scrollTo(0,1400)`);
  await pause(180);
  check('Leaving the viewport cancels motion and restores dots', await transformed() === 0 && await idle());
  await evaluate(`scrollTo(0,0); document.querySelector('.dot-exhibit').style.marginBottom=''`);

  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(100);
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p });
  check('Changing to reduced motion immediately disables displacement', await transformed() === 0 && await idle());
  await load();
  await pause(100);
  check('Reduced motion skips entrance completely', await idle() && !await evaluate(`!!document.querySelector('[data-dot-layer] [opacity="0"]')`));
  await screenshot('dot-art-reduced-motion.png');
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await load(); await pause(1350);
  check('Reloading gives identical deterministic geometry', original === await geometry());

  await load(390, 844, true); await pause(1300);
  check('Mobile density is 2,600 marks', await count() === 2600);
  await evaluate(`document.querySelector('[data-dot-art]').scrollIntoView({block:'start'})`);
  await pause(100);
  await screenshot('dot-art-mobile.png');
  check('Mobile layout fits without horizontal overflow', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touch = await position(410, 250);
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] });
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(100);
  check('A touch tap produces a ripple', await transformed() > 0);
  await pause(1000);
  await evaluate(`document.querySelector('.dot-footer').style.marginBottom='600px'`);
  const scrollBefore = await evaluate('scrollY');
  await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x, y: touch.y+80 }] });
  for (let i = 1; i <= 6; i++) {
    await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x, y: touch.y+80-i*20 }] });
    await pause(20);
  }
  await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pause(160);
  check('Dragging the artwork preserves natural touch scrolling', await evaluate('scrollY') > scrollBefore);
  check('Scrolling does not trigger a tap ripple', await transformed() === 0);

  await call('Emulation.setTouchEmulationEnabled', { enabled: false });
  await load(320, 760); await pause(100);
  check('320px layout has no horizontal overflow', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await call('Emulation.setScriptExecutionDisabled', { value: true });
  await call('Page.navigate', { url: pathToFileURL(path.join(root, 'dot-art.html')).href });
  await pause(250);
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  check('Static inline artwork is present without JavaScript', await count() > 5200);
  check('No browser JavaScript errors', errors.length === 0);
  await fs.writeFile(path.join(root, 'previews/dot-art-checks.json'), JSON.stringify({ browser: 'Headless Chrome', checks: results }, null, 2));
  console.log(`${results.length} checks passed.`);
} finally {
  await call('Page.close');
  ws.close();
}
