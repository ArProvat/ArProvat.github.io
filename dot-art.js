/* Edit these defaults, or set window.DOT_ART_CONFIG before this script loads.
 * Density is capped by the ~6,000 authored marks in the inline SVG.
 * The SVG contains the complete static art; JavaScript only enhances it.
 */
(() => {
  'use strict';
  const CONFIG = {
    density: { desktop: 5200, mobile: 2600 },
    palette: ['#CC8A32', '#B64D32', '#E2B64C', '#F2E3C6', '#35251E', '#211E1B'],
    dotSize: 1.3,
    interactionRadius: 86, // All distances are in SVG viewBox units.
    motionStrength: 4.5,
    rippleRadius: 125,
    rippleStrength: 3.8,
    entranceDuration: 1200,
    seed: 271828,
    ...window.DOT_ART_CONFIG,
    density: { desktop: 5200, mobile: 2600, ...window.DOT_ART_CONFIG?.density },
  };

  const mix = (a, b, amount) => '#' + [1, 3, 5].map(i => {
    const from = parseInt(a.slice(i, i + 2), 16);
    return Math.round(from + (parseInt(b.slice(i, i + 2), 16) - from) * amount).toString(16).padStart(2, '0');
  }).join('');

  document.querySelectorAll('[data-dot-art]').forEach((root, instance) => {
    const svg = root.querySelector('[data-dot-svg]');
    if (!svg) return;
    const layer = svg.querySelector('[data-dot-layer]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = matchMedia('(max-width: 640px)');
    const events = new AbortController();
    const listen = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: events.signal });
    const forcedStatic = root.dataset.motion === 'off';
    const motionAllowed = () => !reduced.matches && !forcedStatic && 'IntersectionObserver' in window;
    const status = root.querySelector('[data-dot-status]');
    const resetButton = root.querySelector('[data-dot-reset]');
    const namespace = `dot-${instance}`;
    // Unique paint/title IDs allow multiple independent portraits on one page.
    svg.querySelectorAll('[id]').forEach(node => { node.id = `${namespace}-${node.id}`; });
    svg.setAttribute('aria-labelledby', `${namespace}-dot-title ${namespace}-dot-description`);
    function applyPalette(palette, background) {
      palette.forEach((color, index) => {
        const stops = svg.querySelectorAll(`#${namespace}-dot-paint-${index} stop`);
        [mix(color, palette[3], .14), color, mix(color, palette[4], .14)]
          .forEach((shade, i) => stops[i]?.setAttribute('stop-color', shade));
      });
      svg.querySelector('[data-dot-background]').setAttribute('fill', background);
    }
    applyPalette(CONFIG.palette, CONFIG.palette[5]);
    root.dataset.dotVariant = 'earth';
    const themeButtons = [...root.querySelectorAll('[data-dot-theme]')];
    themeButtons.forEach(button => { button.disabled = false; });
    listen(root, 'click', event => {
      const button = event.target.closest('[data-dot-theme]');
      if (!button) return;
      const theme = button.dataset.dotTheme;
      const palette = theme === 'earth' ? CONFIG.palette : button.dataset.dotPalette.split(',');
      applyPalette(palette, theme === 'earth' ? palette[5] : button.dataset.dotBackground);
      root.dataset.dotVariant = theme;
      root.style.setProperty('--dot-note-color', button.dataset.dotNote);
      themeButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      root.querySelector('[data-dot-download]').href = button.dataset.dotFile;
      const legend = root.closest('.dot-page')?.querySelector('.dot-palette');
      if (legend) {
        [...legend.children].forEach((swatch, i) => swatch.style.setProperty('--swatch', palette[i]));
        legend.setAttribute('aria-label', `${button.textContent.trim()} portrait palette`);
        root.closest('.dot-page').querySelector('.dot-palette-label').textContent = button.dataset.dotCaption;
      }
      status.textContent = `${button.textContent.trim()} portrait selected. Download SVG saves this color version.`;
    });

    let seed = CONFIG.seed >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const master = [...layer.children].map(node => {
      node.setAttribute('fill', node.getAttribute('fill').replace('#dot-paint-', `#${namespace}-dot-paint-`));
      const x = +node.getAttribute('cx'), y = +node.getAttribute('cy');
      return { node, x, y, rx: +node.getAttribute('rx'), ry: +node.getAttribute('ry'),
        opacity: +node.getAttribute('opacity'), dx: 0, dy: 0, tx: 0, ty: 0,
        delay: Math.max(0, Math.min(1, (y + 30*Math.sin(x/80) - 30)/760)) * .76 + random()*.035 };
    });
    const active = new Set(), hovered = new Set(), fading = new Set();
    const buckets = new Map();
    const cell = Math.max(16, CONFIG.interactionRadius);
    let dots = [], revealQueue = [], revealIndex = 0, revealStart = null;
    let ripples = [], pointerEvent = null, tap = null;
    let raf = 0, previous = 0, visible = false, entered = false, suspended = false, destroyed = false;
    const canAnimate = () => motionAllowed() && visible && !document.hidden && !suspended && !destroyed;

    function nearby(x, y, radius) {
      const found = [];
      for (let bx = Math.floor((x-radius)/cell); bx <= Math.floor((x+radius)/cell); bx++) {
        for (let by = Math.floor((y-radius)/cell); by <= Math.floor((y+radius)/cell); by++) {
          for (const dot of buckets.get(`${bx},${by}`) || []) {
            if ((dot.x-x)**2 + (dot.y-y)**2 < radius*radius) found.push(dot);
          }
        }
      }
      return found;
    }

    function point(event) {
      const matrix = svg.getScreenCTM();
      return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
    }

    function wake() {
      if (!raf && canAnimate()) {
        root.dataset.dotState = 'animating';
        raf = requestAnimationFrame(frame);
      }
    }

    function clearPointer() {
      pointerEvent = null;
      for (const dot of hovered) { dot.tx = dot.ty = 0; active.add(dot); }
      hovered.clear();
      wake();
    }

    function restore() {
      cancelAnimationFrame(raf);
      raf = previous = 0;
      pointerEvent = tap = null;
      for (const dot of new Set([...active, ...hovered])) {
        dot.dx = dot.dy = dot.tx = dot.ty = 0;
        dot.node.removeAttribute('transform');
      }
      for (const dot of fading) dot.node.setAttribute('opacity', dot.opacity);
      for (let i = revealIndex; i < revealQueue.length; i++) {
        revealQueue[i].node.setAttribute('opacity', revealQueue[i].opacity);
      }
      active.clear(); hovered.clear(); fading.clear();
      ripples = []; revealQueue = []; revealIndex = 0; revealStart = null;
      root.dataset.dotState = motionAllowed() ? 'idle' : 'static';
    }

    function build() {
      restore();
      const count = Math.min(master.length, Math.max(1, Math.round(CONFIG.density[mobile.matches ? 'mobile' : 'desktop'])));
      dots = master.slice(0, count);
      // Fewer dots retain visual weight, with a cap to keep facial details open.
      const size = CONFIG.dotSize * Math.min(1.32, Math.sqrt(CONFIG.density.desktop / count));
      buckets.clear();
      const fragment = document.createDocumentFragment();
      for (const dot of dots) {
        dot.node.setAttribute('rx', (dot.rx * size).toFixed(2));
        dot.node.setAttribute('ry', (dot.ry * size).toFixed(2));
        dot.node.setAttribute('opacity', dot.opacity);
        fragment.append(dot.node);
        const key = `${Math.floor(dot.x/cell)},${Math.floor(dot.y/cell)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(dot);
      }
      layer.replaceChildren(fragment);
      root.dataset.dotReady = '';
      root.querySelector('[data-dot-count]').textContent = `${count.toLocaleString()} painted marks`;
      if (!entered && motionAllowed()) {
        revealQueue = [...dots].sort((a, b) => a.delay - b.delay);
        for (const dot of dots) dot.node.setAttribute('opacity', '0');
      }
    }

    function frame(now) {
      raf = 0;
      if (!canAnimate()) { restore(); return; }
      const ease = 1 - Math.exp(-Math.min(48, previous ? now-previous : 16.7)/65);
      previous = now;
      let moving = false;
      if (revealQueue.length) {
        if (revealStart === null) revealStart = now;
        const progress = (now-revealStart)/Math.max(1, CONFIG.entranceDuration);
        while (revealIndex < revealQueue.length && revealQueue[revealIndex].delay <= progress) {
          fading.add(revealQueue[revealIndex++]);
        }
        for (const dot of fading) {
          const alpha = Math.min(1, (progress-dot.delay)/.2);
          dot.node.setAttribute('opacity', (dot.opacity*(1-(1-alpha)**3)).toFixed(3));
          if (alpha >= 1) fading.delete(dot);
        }
        if (revealIndex === revealQueue.length && !fading.size) revealQueue = [];
      }
      if (pointerEvent) {
        const p = point(pointerEvent);
        pointerEvent = null;
        for (const dot of hovered) { dot.tx = dot.ty = 0; active.add(dot); }
        hovered.clear();
        if (p) for (const dot of nearby(p.x, p.y, CONFIG.interactionRadius)) {
          const dx = dot.x-p.x, dy = dot.y-p.y, distance = Math.hypot(dx, dy);
          const strength = CONFIG.motionStrength*(1-distance/CONFIG.interactionRadius)**2;
          dot.tx = dx/Math.max(1, distance)*strength;
          dot.ty = dy/Math.max(1, distance)*strength;
          hovered.add(dot); active.add(dot);
        }
      }
      ripples = ripples.filter(r => now-r.start < 680);
      for (const dot of active) {
        let tx = dot.tx, ty = dot.ty;
        for (const ripple of ripples) {
          const dx = dot.x-ripple.x, dy = dot.y-ripple.y, distance = Math.hypot(dx, dy);
          if (distance >= CONFIG.rippleRadius) continue;
          const progress = (now-ripple.start)/680;
          const band = (distance - progress*CONFIG.rippleRadius)/22;
          const strength = CONFIG.rippleStrength*Math.exp(-band*band)*(1-progress)*(1-distance/CONFIG.rippleRadius);
          tx += dx/Math.max(1, distance)*strength;
          ty += dy/Math.max(1, distance)*strength;
        }
        const dx = dot.dx+(tx-dot.dx)*ease, dy = dot.dy+(ty-dot.dy)*ease;
        const settled = Math.abs(tx-dx)+Math.abs(ty-dy) < .012;
        const nextX = settled ? tx : dx, nextY = settled ? ty : dy;
        if (nextX !== dot.dx || nextY !== dot.dy) {
          if (nextX === 0 && nextY === 0) dot.node.removeAttribute('transform');
          else dot.node.setAttribute('transform', `translate(${nextX.toFixed(3)} ${nextY.toFixed(3)})`);
        }
        dot.dx = nextX; dot.dy = nextY;
        if (!settled) moving = true;
        if (settled && !ripples.length) active.delete(dot);
      }
      if (revealQueue.length || ripples.length || moving) wake();
      else { previous = 0; root.dataset.dotState = 'idle'; }
    }

    function reconcile() {
      const allowed = motionAllowed();
      const modeEl = root.querySelector('[data-dot-mode]');
      if (modeEl) modeEl.textContent = allowed ? 'Interactive portrait' : 'Static portrait';
      const hintEl = root.querySelector('[data-dot-hint]');
      if (hintEl) hintEl.textContent = allowed ? 'Interactive' : 'Quiet composition';
      if (!canAnimate()) {
        // Before first appearance, retain the pending reveal. Afterward, restore
        // once and do no work while offscreen or while the tab is hidden.
        if (entered || !allowed) restore();
        if (!allowed) entered = true;
        root.dataset.dotState = allowed ? 'offscreen' : 'static';
      } else {
        if (!entered) { entered = true; wake(); }
        else if (active.size || revealQueue.length) wake();
        else root.dataset.dotState = 'idle';
      }
    }

    listen(svg, 'pointermove', event => {
      if (event.pointerType === 'touch' || !canAnimate()) return;
      pointerEvent = { clientX: event.clientX, clientY: event.clientY };
      wake();
    }, { passive: true });
    listen(svg, 'pointerleave', () => { tap = null; clearPointer(); });
    listen(svg, 'pointerdown', event => {
      if (event.isPrimary && event.button === 0 && canAnimate()) {
        tap = { x: event.clientX, y: event.clientY, start: performance.now(), id: event.pointerId };
      }
    }, { passive: true });
    listen(svg, 'pointerup', event => {
      if (tap && tap.id === event.pointerId && performance.now()-tap.start < 500 &&
          Math.hypot(event.clientX-tap.x, event.clientY-tap.y) < 10 && canAnimate()) {
        const p = point(event);
        if (p) {
          // At most three localized ripples can overlap.
          ripples = [...ripples.slice(-2), { x: p.x, y: p.y, start: performance.now() }];
          for (const dot of nearby(p.x, p.y, CONFIG.rippleRadius)) active.add(dot);
          wake();
        }
      }
      tap = null;
    }, { passive: true });
    listen(svg, 'pointercancel', () => { tap = null; clearPointer(); });
    listen(window, 'scroll', () => { tap = null; if (hovered.size || pointerEvent) clearPointer(); }, { passive: true });
    listen(resetButton, 'click', () => {
      // Include held dots whose frame loop has already settled.
      for (const dot of hovered) active.add(dot);
      restore();
      entered = true;
      status.textContent = 'Portrait reset to its resting position.';
    });
    resetButton.disabled = false;

    listen(root.querySelector('[data-dot-download]'), 'click', event => {
      event.preventDefault();
      const copy = svg.cloneNode(true);
      const exported = copy.querySelector('[data-dot-layer]').children;
      // Never export partially revealed opacity or interactive displacement.
      dots.forEach((dot, i) => {
        exported[i].removeAttribute('transform');
        exported[i].setAttribute('opacity', dot.opacity);
      });
      copy.querySelector('desc').textContent += ' This is the complete static artwork; it contains no interactive behavior.';
      for (const node of [copy, ...copy.querySelectorAll('*')]) {
        for (const name of node.getAttributeNames()) if (name.startsWith('data-')) node.removeAttribute(name);
      }
      const source = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(copy);
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = root.dataset.dotVariant === 'earth' ? 'the-maker.svg' : `the-maker-${root.dataset.dotVariant}.svg`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      status.textContent = `Downloaded the complete static portrait with ${dots.length.toLocaleString()} dots.`;
    });
    listen(mobile, 'change', () => { build(); reconcile(); });
    listen(reduced, 'change', reconcile);
    listen(document, 'visibilitychange', reconcile);
    listen(window, 'pagehide', () => { suspended = true; reconcile(); });
    listen(window, 'pageshow', () => { suspended = false; reconcile(); });
    build();
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      reconcile();
    }) : null;
    observer?.observe(svg);
    listen(root, 'dot-art:destroy', () => {
      for (const dot of hovered) active.add(dot);
      destroyed = true; restore(); observer?.disconnect(); events.abort();
    }, { once: true });
    reconcile();
  });
})();
