/**
 * Interactive Stippled Portrait Controller
 * - Responsive pointer displacement (4-8px)
 * - Localized click/tap ripple with smooth 600-900ms dampening
 * - Facial detail protection against distortion
 * - Spatial bucketing for 60fps performance without idle RAF loops
 * - Full reduced-motion & static fallback support
 */
(() => {
  'use strict';

  function initPortrait() {
    const root = document.querySelector('[data-hero-portrait]');
    if (!root) return;
    const svg = root.querySelector('svg');
    if (!svg) return;
    const layer = svg.querySelector('[data-dot-layer]');
    if (!layer) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isForcedStatic = root.dataset.motion === 'off';
    if (reduced.matches || isForcedStatic) return;

    const cell = 86;
    const buckets = new Map();
    const dots = [];

    const children = Array.from(layer.children);
    const isMobile = window.innerWidth <= 640;

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (isMobile && i >= 2600) {
        node.style.display = 'none';
        continue;
      }
      const x = parseFloat(node.getAttribute('cx'));
      const y = parseFloat(node.getAttribute('cy'));
      if (isNaN(x) || isNaN(y)) continue;

      // Facial detail protection: preserve key features from excessive distortion
      const isFace = (y >= 235 && y <= 345 && x >= 325 && x <= 455);
      const protectFactor = isFace ? 0.35 : 1.0;

      const dot = {
        node,
        x,
        y,
        dx: 0,
        dy: 0,
        vx: 0,
        vy: 0,
        protectFactor
      };
      dots.push(dot);

      const bx = Math.floor(x / cell);
      const by = Math.floor(y / cell);
      const key = `${bx},${by}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(dot);
    }

    function getNearby(px, py, radius) {
      const minBx = Math.floor((px - radius) / cell);
      const maxBx = Math.floor((px + radius) / cell);
      const minBy = Math.floor((py - radius) / cell);
      const maxBy = Math.floor((py + radius) / cell);
      const result = [];
      const r2 = radius * radius;
      for (let bx = minBx; bx <= maxBx; bx++) {
        for (let by = minBy; by <= maxBy; by++) {
          const list = buckets.get(`${bx},${by}`);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const d = list[i];
            const dist2 = (d.x - px) ** 2 + (d.y - py) ** 2;
            if (dist2 < r2) result.push({ dot: d, dist: Math.sqrt(dist2) });
          }
        }
      }
      return result;
    }

    let pointer = null;
    let ripple = null;
    let rafId = null;
    let isVisible = true;
    const activeDots = new Set();

    function getSvgPoint(e) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const scaleX = 760 / rect.width;
      const scaleY = 860 / rect.height;
      const clientX = e.clientX ?? (e.touches && e.touches[0] ? e.touches[0].clientX : null);
      const clientY = e.clientY ?? (e.touches && e.touches[0] ? e.touches[0].clientY : null);
      if (clientX === null || clientY === null) return null;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    const spring = 0.12;
    const damping = 0.78;
    const maxDisplacement = 6.5; // 4-8px displacement

    function animate(now) {
      if (!isVisible || reduced.matches || isForcedStatic) {
        rafId = null;
        return;
      }

      let hasMotion = false;

      // 1. Pointer displacement
      if (pointer) {
        const radius = 85;
        const nearby = getNearby(pointer.x, pointer.y, radius);
        for (let i = 0; i < nearby.length; i++) {
          const { dot, dist } = nearby[i];
          if (dist < 1) continue;
          const normX = (dot.x - pointer.x) / dist;
          const normY = (dot.y - pointer.y) / dist;
          const force = (1 - dist / radius) * maxDisplacement * dot.protectFactor;
          dot.vx += (normX * force - dot.dx) * 0.28;
          dot.vy += (normY * force - dot.dy) * 0.28;
          activeDots.add(dot);
        }
      }

      // 2. Click / tap ripple
      if (ripple) {
        const elapsed = now - ripple.startTime;
        const progress = elapsed / ripple.duration;
        if (progress >= 1.0) {
          ripple = null;
        } else {
          hasMotion = true;
          const currentRadius = progress * ripple.maxRadius;
          const ringWidth = 36;
          const strength = Math.sin(progress * Math.PI) * 4.2;
          const nearby = getNearby(ripple.x, ripple.y, currentRadius + ringWidth);
          for (let i = 0; i < nearby.length; i++) {
            const { dot, dist } = nearby[i];
            const distFromRing = Math.abs(dist - currentRadius);
            if (distFromRing < ringWidth) {
              const ringFactor = (1 - distFromRing / ringWidth) * strength * dot.protectFactor;
              if (dist > 0.1) {
                const nx = (dot.x - ripple.x) / dist;
                const ny = (dot.y - ripple.y) / dist;
                dot.vx += nx * ringFactor * 0.22;
                dot.vy += ny * ringFactor * 0.22;
                activeDots.add(dot);
              }
            }
          }
        }
      }

      // 3. Physics integration and settling
      const toRemove = [];
      for (const dot of activeDots) {
        dot.vx += -spring * dot.dx;
        dot.vy += -spring * dot.dy;
        dot.vx *= damping;
        dot.vy *= damping;
        dot.dx += dot.vx;
        dot.dy += dot.vy;

        if (Math.abs(dot.dx) < 0.04 && Math.abs(dot.dy) < 0.04 && Math.abs(dot.vx) < 0.04 && Math.abs(dot.vy) < 0.04 && !pointer) {
          dot.dx = 0;
          dot.dy = 0;
          dot.vx = 0;
          dot.vy = 0;
          dot.node.removeAttribute('transform');
          toRemove.push(dot);
        } else {
          dot.node.setAttribute('transform', `translate(${dot.dx.toFixed(2)}, ${dot.dy.toFixed(2)})`);
          hasMotion = true;
        }
      }

      for (let i = 0; i < toRemove.length; i++) {
        activeDots.delete(toRemove[i]);
      }

      if (hasMotion || pointer || ripple) {
        rafId = requestAnimationFrame(animate);
      } else {
        rafId = null;
      }
    }

    function startAnimation() {
      if (!rafId && isVisible && !reduced.matches && !isForcedStatic) {
        rafId = requestAnimationFrame(animate);
      }
    }

    svg.addEventListener('pointerenter', (e) => {
      if (reduced.matches || isForcedStatic) return;
      pointer = getSvgPoint(e);
      startAnimation();
    }, { passive: true });

    svg.addEventListener('pointermove', (e) => {
      if (reduced.matches || isForcedStatic) return;
      pointer = getSvgPoint(e);
      startAnimation();
    }, { passive: true });

    svg.addEventListener('pointerleave', () => {
      pointer = null;
      startAnimation();
    }, { passive: true });

    svg.addEventListener('pointerdown', (e) => {
      if (reduced.matches || isForcedStatic) return;
      const pt = getSvgPoint(e);
      if (!pt) return;
      ripple = {
        x: pt.x,
        y: pt.y,
        startTime: performance.now(),
        maxRadius: 160,
        duration: 750 // Settles in 600-900ms
      };
      startAnimation();
    }, { passive: true });

    // IntersectionObserver suspends RAF when off-screen
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && (pointer || ripple || activeDots.size > 0)) {
          startAnimation();
        } else if (!isVisible && rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }, { threshold: 0.1 });
      observer.observe(root);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPortrait);
  } else {
    initPortrait();
  }
})();
