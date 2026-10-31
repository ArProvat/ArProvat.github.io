/**
 * Celestial Portfolio Hero, Planetary Horizon Dome & Interactive Dot Portrait Controller
 * - 28 distant stars on desktop (18 on mobile): most 1px at 15-35% opacity, a few 1.5-2px up to 50% opacity
 * - Irregular spacing with generous empty space; kept away from text/controls and hidden behind #08090C planet
 * - Only 5 stars slowly vary opacity over 6-10s with distinct timings; respects reduced-motion
 * - Localized 90px portrait dot repulsion (max 6px displacement, quadratic falloff, subtle brightening)
 * - Frame-rate-independent damped easing (immediate soft response, 400-700ms return to rest)
 * - Static horizon curve geometry with subtle ±60px eased highlight shift
 * - Single RAF loop; pauses when hero is offscreen or tab is hidden; respects reduced-motion and coarse pointers
 */
(() => {
  'use strict';

  function initHero() {
    const heroSection = document.querySelector('[data-hero]');
    const root = document.querySelector('[data-hero-portrait]');
    if (!heroSection || !root) return;

    const svg = root.querySelector('svg');
    const layer = svg ? svg.querySelector('[data-dot-layer]') : null;
    const starCanvas = document.getElementById('hero-star-canvas');
    const horizonHighlightGrad = document.getElementById('horizon-highlight-grad');

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    const isForcedStatic = root.dataset.motion === 'off' || heroSection.dataset.motion === 'off';

    let isHeroVisible = true;
    let drawStarsAt = null;
    let twinkleTimer = null;
    let heroPointer = null;
    let starsActive = false;

    // 1. Distant celestial stars (28 on desktop, 18 on mobile; away from text/controls & hidden behind #08090C planet)
    if (starCanvas) {
      const sCtx = starCanvas.getContext('2d');
      let seed = 20261031;
      const rand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const masterStars = [];
      const twinklePeriods = [6400, 7300, 8200, 9100, 9800, 7800];
      const twinklePhases = [0.4, 1.9, 3.3, 4.6, 5.8, 2.5];
      let attempts = 0;

      while (masterStars.length < 32 && attempts < 1200) {
        attempts++;
        const nx = 0.03 + rand() * 0.94;
        const ny = 0.06 + rand() * 0.74; // Sky region above the #08090C planetary surface

        // Keep stars away from left-column headline, copy, CTA buttons, and social links
        if (nx >= 0.07 && nx <= 0.42 && ny >= 0.18 && ny <= 0.65) continue;
        // Keep stars out of the dense lower portrait body/laptop so they sit in clear open sky
        if (nx >= 0.55 && nx <= 0.86 && ny >= 0.36 && ny <= 0.76) continue;
        // Keep stars away from top navigation controls
        if (ny < 0.11 && (nx < 0.22 || (nx > 0.25 && nx < 0.75) || nx > 0.82)) continue;

        // Enforce irregular distribution with generous empty space between stars
        let tooClose = false;
        for (let j = 0; j < masterStars.length; j++) {
          const dx = masterStars[j].nx - nx;
          const dy = masterStars[j].ny - ny;
          if (Math.hypot(dx, dy) < 0.076) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        const idx = masterStars.length;
        // A few stars (7 of 32, ~22%): 1.5-2px diameter (0.85-1.15px radius) at up to 50% opacity
        // Most stars (25 of 32, ~78%): ~1px crisp star core (0.65-0.80px radius to compensate for subpixel AA) at 22-35% opacity
        const isLargerStar = idx % 4 === 1 && idx < 28;
        const radius = isLargerStar
          ? 0.90 + rand() * 0.25
          : 0.65 + rand() * 0.15;
        const baseAlpha = isLargerStar
          ? 0.42 + rand() * 0.08
          : 0.22 + rand() * 0.13;

        // Depth factor for subtle pointer parallax (<= 3px)
        const depth = isLargerStar ? 0.85 + rand() * 0.15 : 0.45 + rand() * 0.40;

        // Let only 6 stars change opacity slowly over 6-10 seconds with different timings
        const twinkleSlot = idx % 5 === 0 && idx < 30 ? Math.floor(idx / 5) : -1;
        const period = twinkleSlot >= 0 ? twinklePeriods[twinkleSlot] : 0;
        const phase = twinkleSlot >= 0 ? twinklePhases[twinkleSlot] : 0;

        masterStars.push({
          nx,
          ny,
          radius,
          baseAlpha,
          isLargerStar,
          depth,
          period,
          phase,
          dx: 0,
          dy: 0,
          tx: 0,
          ty: 0,
          boost: 0,
          tBoost: 0
        });
      }

      let cachedW = 0;
      let cachedH = 0;
      let cachedDpr = 1;

      const syncCanvasSize = () => {
        const rect = heroSection.getBoundingClientRect();
        cachedW = Math.max(1, Math.floor(rect.width));
        cachedH = Math.max(1, Math.floor(rect.height));
        cachedDpr = Math.min(window.devicePixelRatio || 1, 2);
        starCanvas.width = Math.floor(cachedW * cachedDpr);
        starCanvas.height = Math.floor(cachedH * cachedDpr);
      };

      drawStarsAt = (nowMs = 0, dtMs = 16.67, parallaxX = 0, parallaxY = 0) => {
        if (!sCtx) return;
        if (!cachedW || !cachedH) syncCanvasSize();
        sCtx.setTransform(cachedDpr, 0, 0, cachedDpr, 0, 0);
        sCtx.clearRect(0, 0, cachedW, cachedH);

        const allowMotion = !reducedMotion.matches && !isForcedStatic;
        const allowTwinkle = allowMotion && nowMs > 0;
        const isStacked = window.innerWidth <= 1024;
        const count = window.innerWidth <= 640 ? 20 : 32;
        const starRadiusCss = 150;
        const maxStarDisp = 5.5;
        const easeAttack = 1 - Math.exp(-dtMs / 60);
        const easeReturn = 1 - Math.exp(-dtMs / 105);

        let anyStarMoving = false;

        for (let i = 0; i < Math.min(count, masterStars.length); i++) {
          const s = masterStars[i];
          // On stacked tablet/mobile layouts, keep stars out of the centered text & CTA region
          if (isStacked && s.ny < 0.54 && s.nx > 0.14 && s.nx < 0.86) continue;

          const baseX = Math.round(s.nx * cachedW) + 0.5;
          const baseY = Math.round(s.ny * cachedH) + 0.5;

          // Compute localized pointer interaction with stars (repulsion + subtle brightening)
          if (allowMotion && heroPointer && finePointer.matches) {
            const vx = baseX - heroPointer.x;
            const vy = baseY - heroPointer.y;
            const dist = Math.hypot(vx, vy);
            if (dist < starRadiusCss) {
              const inf = Math.max(0, 1 - dist / starRadiusCss) ** 2;
              const ux = dist > 0.001 ? vx / dist : 0;
              const uy = dist > 0.001 ? vy / dist : 0;
              s.tx = ux * inf * maxStarDisp;
              s.ty = uy * inf * maxStarDisp;
              s.tBoost = inf * 0.28;
            } else {
              s.tx = 0;
              s.ty = 0;
              s.tBoost = 0;
            }
          } else {
            s.tx = 0;
            s.ty = 0;
            s.tBoost = 0;
          }

          if (allowMotion) {
            const isReturning = s.tx === 0 && s.ty === 0 && s.tBoost === 0;
            const ease = isReturning ? easeReturn : easeAttack;
            s.dx += (s.tx - s.dx) * ease;
            s.dy += (s.ty - s.dy) * ease;
            s.boost += (s.tBoost - s.boost) * ease;

            if (isReturning && Math.hypot(s.dx, s.dy) < 0.03 && Math.abs(s.boost) < 0.003) {
              s.dx = 0;
              s.dy = 0;
              s.boost = 0;
            } else {
              anyStarMoving = true;
            }
          } else {
            s.dx = 0;
            s.dy = 0;
            s.boost = 0;
          }

          let alpha = s.baseAlpha;
          if (allowTwinkle && s.period > 0) {
            const wave = Math.sin((nowMs / s.period) * Math.PI * 2 + s.phase);
            alpha = Math.max(0.16, Math.min(0.50, s.baseAlpha + wave * 0.08));
          }
          alpha = Math.min(0.76, alpha + s.boost);

          const drawX = baseX + parallaxX * s.depth + s.dx;
          const drawY = baseY + parallaxY * s.depth + s.dy;
          const drawR = s.radius + s.boost * 1.25;

          // Subtle soft halo on larger stars and when pointer interacts with a nearby star
          if (s.isLargerStar || s.boost > 0.02) {
            const haloAlpha = s.isLargerStar
              ? alpha * 0.22 + s.boost * 0.35
              : s.boost * 0.42;
            sCtx.beginPath();
            sCtx.arc(drawX, drawY, drawR * 2.5, 0, Math.PI * 2);
            sCtx.fillStyle = `rgba(173, 188, 232, ${haloAlpha.toFixed(3)})`;
            sCtx.fill();
          }

          sCtx.beginPath();
          sCtx.arc(drawX, drawY, drawR, 0, Math.PI * 2);
          sCtx.fillStyle = s.isLargerStar || s.boost > 0.04
            ? `rgba(235, 241, 255, ${alpha.toFixed(3)})`
            : `rgba(214, 224, 248, ${alpha.toFixed(3)})`;
          sCtx.fill();
        }

        starsActive = anyStarMoving;
      };

      syncCanvasSize();
      drawStarsAt(0, 16.67, 0, 0);

      window.addEventListener('resize', () => {
        syncCanvasSize();
        drawStarsAt(performance.now(), 16.67, 0, 0);
      }, { passive: true });
    }

    function updateTwinkleTimer() {
      const shouldRun =
        Boolean(drawStarsAt) &&
        isHeroVisible &&
        !document.hidden &&
        !reducedMotion.matches &&
        !isForcedStatic;
      if (shouldRun && !twinkleTimer) {
        twinkleTimer = window.setInterval(() => {
          if (!rafId && drawStarsAt) {
            drawStarsAt(performance.now());
          }
        }, 140);
      } else if (!shouldRun && twinkleTimer) {
        clearInterval(twinkleTimer);
        twinkleTimer = null;
      }
    }

    // 2. Spatial bucketing for portrait particles
    const cell = 90;
    const buckets = new Map();
    const allDots = [];

    if (layer) {
      const children = Array.from(layer.children);
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        const x = parseFloat(node.getAttribute('cx'));
        const y = parseFloat(node.getAttribute('cy'));
        if (isNaN(x) || isNaN(y)) continue;

        const baseOpacity = parseFloat(node.getAttribute('opacity') || '0.55');
        // Facial features protection so eyes, glasses, and expression stay recognizable
        const isFacialFeature = y >= 175 && y <= 315 && x >= 325 && x <= 460;
        const protectFactor = isFacialFeature ? 0.65 : 1.0;

        const dot = {
          node,
          index: i,
          x,
          y,
          baseOpacity,
          dx: 0,
          dy: 0,
          tx: 0,
          ty: 0,
          boost: 0,
          tBoost: 0,
          protectFactor
        };
        allDots.push(dot);

        const key = `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(dot);
      }
    }

    const canInteract = () =>
      !reducedMotion.matches && finePointer.matches && !isForcedStatic;

    function getNearbyDots(px, py, radiusSvg) {
      const minBx = Math.floor((px - radiusSvg) / cell);
      const maxBx = Math.floor((px + radiusSvg) / cell);
      const minBy = Math.floor((py - radiusSvg) / cell);
      const maxBy = Math.floor((py + radiusSvg) / cell);
      const result = [];
      const r2 = radiusSvg * radiusSvg;
      const isMobile = window.innerWidth <= 640;

      for (let bx = minBx; bx <= maxBx; bx++) {
        for (let by = minBy; by <= maxBy; by++) {
          const list = buckets.get(`${bx},${by}`);
          if (!list) continue;
          for (let i = 0; i < list.length; i++) {
            const d = list[i];
            if (isMobile && d.index >= 3000) continue;
            const dist2 = (d.x - px) ** 2 + (d.y - py) ** 2;
            if (dist2 < r2) result.push(d);
          }
        }
      }
      return result;
    }

    // 3. Single RAF animation loop for portrait particles, background parallax, and horizon highlight
    let rafId = null;
    let lastTime = 0;
    let lastStarDraw = 0;
    let pointerInsideHero = false;
    let svgPointer = null;

    const activeDots = new Set();
    const hoveredDots = new Set();

    const target = {
      normX: 0,
      normY: 0,
      horizonShift: 0, // Capped at ±60px
      horizonBoost: 0
    };
    const current = {
      normX: 0,
      normY: 0,
      horizonShift: 0,
      horizonBoost: 0
    };

    function getSvgPointAndScale(e) {
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width
        ? svg.viewBox.baseVal
        : { width: 760, height: 760 };
      const cssPerSvgX = rect.width / vb.width;
      const cssPerSvgY = rect.height / vb.height;
      return {
        x: (e.clientX - rect.left) / cssPerSvgX,
        y: (e.clientY - rect.top) / cssPerSvgY,
        cssPerSvgX,
        cssPerSvgY
      };
    }

    function clearHoveredTargets() {
      for (const dot of hoveredDots) {
        dot.tx = 0;
        dot.ty = 0;
        dot.tBoost = 0;
        activeDots.add(dot);
      }
      hoveredDots.clear();
    }

    function restoreAllImmediate() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = 0;
      heroPointer = null;
      svgPointer = null;
      if (drawStarsAt) drawStarsAt(0, 16.67, 0, 0);
      for (const dot of new Set([...activeDots, ...hoveredDots])) {
        dot.dx = 0;
        dot.dy = 0;
        dot.tx = 0;
        dot.ty = 0;
        dot.boost = 0;
        dot.tBoost = 0;
        dot.node.removeAttribute('transform');
        dot.node.setAttribute('opacity', dot.baseOpacity.toFixed(2));
      }
      activeDots.clear();
      hoveredDots.clear();
    }

    function tick(now) {
      if (!isHeroVisible || document.hidden || !canInteract()) {
        rafId = null;
        lastTime = 0;
        return;
      }

      const dt = Math.min(48, lastTime ? now - lastTime : 16.67);
      lastTime = now;

      // Frame-rate-independent easing for background parallax & horizon highlight
      const bgEase = 1 - Math.exp(-dt / 140);
      const horizonEase = 1 - Math.exp(-dt / 220);

      current.normX += (target.normX - current.normX) * bgEase;
      current.normY += (target.normY - current.normY) * bgEase;
      current.horizonShift += (target.horizonShift - current.horizonShift) * horizonEase;
      current.horizonBoost += (target.horizonBoost - current.horizonBoost) * horizonEase;

      // Star depth parallax capped at 3px
      const bgShiftX = Math.max(-3, Math.min(3, -current.normX * 2.8));
      const bgShiftY = Math.max(-3, Math.min(3, -current.normY * 2.8));
      heroSection.style.setProperty('--bg-shift-x', `${bgShiftX.toFixed(2)}px`);
      heroSection.style.setProperty('--bg-shift-y', `${bgShiftY.toFixed(2)}px`);

      if (drawStarsAt) {
        lastStarDraw = now;
        drawStarsAt(now, dt, bgShiftX, bgShiftY);
      }

      // Horizon highlight shift capped at ±60px along static curve geometry
      heroSection.style.setProperty('--horizon-shift-px', `${current.horizonShift.toFixed(2)}px`);
      heroSection.style.setProperty('--horizon-glow-boost', current.horizonBoost.toFixed(3));
      if (horizonHighlightGrad) {
        const baseStart = 450;
        const baseEnd = 970;
        horizonHighlightGrad.setAttribute('x1', (baseStart + current.horizonShift).toFixed(1));
        horizonHighlightGrad.setAttribute('x2', (baseEnd + current.horizonShift).toFixed(1));
      }

      // Compute target displacement & brightening relative to each dot's original position
      clearHoveredTargets();
      if (svgPointer) {
        const radiusCss = 90;
        const maxDispCss = 6;
        const { x: px, y: py, cssPerSvgX, cssPerSvgY } = svgPointer;
        const scale = Math.max(0.4, cssPerSvgX);
        const radiusSvg = radiusCss / scale;
        // Cap displacement so neither CSS pixel offset nor SVG unit offset exceeds 6px
        const maxDispSvg = Math.min(6, maxDispCss / scale);

        const nearby = getNearbyDots(px, py, radiusSvg);
        for (let i = 0; i < nearby.length; i++) {
          const dot = nearby[i];
          const vecXCss = (dot.x - px) * cssPerSvgX;
          const vecYCss = (dot.y - py) * cssPerSvgY;
          const distCss = Math.hypot(vecXCss, vecYCss);
          if (distCss >= radiusCss) continue;

          // Suggested quadratic falloff: influence = max(0, 1 - distance / radius)^2
          const influence = Math.max(0, 1 - distCss / radiusCss) ** 2;

          // Safe handling of zero pointer-to-particle distance
          let ux = 0;
          let uy = 0;
          if (distCss > 0.001) {
            ux = vecXCss / distCss;
            uy = vecYCss / distCss;
          }

          const disp = influence * maxDispSvg * dot.protectFactor;
          dot.tx = ux * disp;
          dot.ty = uy * disp;
          dot.tBoost = influence * 0.18;

          hoveredDots.add(dot);
          activeDots.add(dot);
        }
      }

      // Damped frame-rate-independent easing:
      // Immediate soft response on enter (~55ms tau), smooth 400-700ms return to rest (~90ms tau)
      const easeAttack = 1 - Math.exp(-dt / 55);
      const easeReturn = 1 - Math.exp(-dt / 90);

      const settledDots = [];
      for (const dot of activeDots) {
        const isReturning = dot.tx === 0 && dot.ty === 0 && dot.tBoost === 0;
        const ease = isReturning ? easeReturn : easeAttack;

        dot.dx += (dot.tx - dot.dx) * ease;
        dot.dy += (dot.ty - dot.dy) * ease;
        dot.boost += (dot.tBoost - dot.boost) * ease;

        const remDist = Math.hypot(dot.tx - dot.dx, dot.ty - dot.dy);
        const remBoost = Math.abs(dot.tBoost - dot.boost);

        if (isReturning && remDist < 0.045 && remBoost < 0.005) {
          dot.dx = 0;
          dot.dy = 0;
          dot.boost = 0;
          dot.node.removeAttribute('transform');
          dot.node.setAttribute('opacity', dot.baseOpacity.toFixed(2));
          settledDots.push(dot);
        } else {
          if (Math.abs(dot.dx) < 0.005 && Math.abs(dot.dy) < 0.005) {
            dot.node.removeAttribute('transform');
          } else {
            dot.node.setAttribute('transform', `translate(${dot.dx.toFixed(2)} ${dot.dy.toFixed(2)})`);
          }
          const nextOpacity = Math.min(0.88, dot.baseOpacity + dot.boost);
          dot.node.setAttribute('opacity', nextOpacity.toFixed(2));
        }
      }

      for (let i = 0; i < settledDots.length; i++) {
        activeDots.delete(settledDots[i]);
      }

      const heroDelta =
        Math.abs(target.normX - current.normX) +
        Math.abs(target.normY - current.normY) +
        Math.abs(target.horizonShift - current.horizonShift) * 0.01 +
        Math.abs(target.horizonBoost - current.horizonBoost);

      if (pointerInsideHero || activeDots.size > 0 || starsActive || heroDelta > 0.002) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
        lastTime = 0;
      }
    }

    function ensureTick() {
      if (!rafId && isHeroVisible && !document.hidden && canInteract()) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }
    }

    heroSection.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || !canInteract()) return;
      pointerInsideHero = true;
      const rect = heroSection.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      heroPointer = { x: localX, y: localY };
      const rx = (localX / w) * 100;
      const ry = (localY / h) * 100;

      target.normX = Math.max(-1, Math.min(1, (rx / 100 - 0.5) * 2));
      target.normY = Math.max(-1, Math.min(1, (ry / 100 - 0.5) * 2));

      // Horizon highlight travel strictly capped at ±60px
      target.horizonShift = Math.max(-60, Math.min(60, target.normX * 55));
      const proximity = Math.max(0, Math.min(1, (ry - 48) / 52));
      target.horizonBoost = proximity * 0.14;

      ensureTick();
    }, { passive: true });

    heroSection.addEventListener('pointerleave', () => {
      pointerInsideHero = false;
      heroPointer = null;
      svgPointer = null;
      target.normX = 0;
      target.normY = 0;
      target.horizonShift = 0;
      target.horizonBoost = 0;
      clearHoveredTargets();
      ensureTick();
    }, { passive: true });

    if (svg) {
      svg.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch' || !canInteract()) return;
        svgPointer = getSvgPointAndScale(e);
        ensureTick();
      }, { passive: true });

      svg.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' || !canInteract()) return;
        svgPointer = getSvgPointAndScale(e);
        ensureTick();
      }, { passive: true });

      svg.addEventListener('pointerleave', () => {
        svgPointer = null;
        clearHoveredTargets();
        ensureTick();
      }, { passive: true });
    }

    // Pause rendering when tab is hidden or hero is offscreen
    document.addEventListener('visibilitychange', () => {
      updateTwinkleTimer();
      if (document.hidden) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
          lastTime = 0;
        }
      } else if (isHeroVisible && (pointerInsideHero || activeDots.size > 0)) {
        ensureTick();
      }
    });

    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener('change', () => {
        updateTwinkleTimer();
        if (reducedMotion.matches) {
          restoreAllImmediate();
          if (drawStarsAt) drawStarsAt(0);
        }
      });
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        isHeroVisible = entry.isIntersecting;
        updateTwinkleTimer();
        if (isHeroVisible && !document.hidden && (pointerInsideHero || activeDots.size > 0)) {
          ensureTick();
        } else if (!isHeroVisible && rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
          lastTime = 0;
        }
      }, { threshold: 0.02 });
      observer.observe(heroSection);
    }

    updateTwinkleTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHero);
  } else {
    initHero();
  }
})();
