# Abdur Rahman - Portfolio & AI Admin Copilot

## 🤖 AI Admin Dashboard (`/admin`)

An AI-powered Admin Dashboard allowing you to manage your **Projects**, **Experience**, **Résumé**, **Writing / Blog**, and **Profile** via both interactive forms and natural-language AI prompts.

### Starting the Admin Server:
```bash
python admin/server.py
```
Open **`http://localhost:8081/admin`** in your browser.

- **AI Copilot Mode**: Instruct in plain English (e.g. *"Add my new project 'DocuChat - Local RAG' with Python and ChromaDB"*). The AI drafts changes and displays a side-by-side JSON diff before applying.
- **Projects & Experience**: Add, edit, reorder, or delete projects and career milestones.
- **Résumé & PDF Sync**: Edit executive summary and skills matrix, or drag-and-drop a new `resume.pdf` to instantly sync the downloadable and embedded PDF.
- **Single Source of Truth**: All data lives in clean JSON schemas inside `/content/`:
  - `content/projects.json`
  - `content/experience.json`
  - `content/resume.json`
  - `content/writing.json`
  - `content/profile.json`
- **Rebuilding Site**: Click **⚡ Rebuild Site** in the dashboard or run `python tools/build_site.py`.


## Writing page

Serve the directory and open `/writing`. The public page currently shows its empty
state because no article details were supplied. Open `/writing/?preview=1` to review
clearly labeled, inactive sample cards, topic filters, and the featured layout.
Add real entries to `window.WRITING_ARTICLES` in `writing-data.js`; both the Writing
page and homepage Latest writing section read from that array.

Set `status: 'published'` only after providing a real `title`, short `excerpt`,
`url`, `platform`, `type` (`article`, `post`, or `note`), `publishedAt` (`YYYY-MM-DD`),
and one of the listed `topic` values. Entries with missing or invalid required
fields are hidden. Optional fields are `tags`, `cover` and `coverAlt` (supply both),
`readingMinutes`, `featured`, and `secondaryLinks: [{ platform, url, type }]` for
the same piece on another platform. The first manually marked featured article is
shown above the grid. Drafts and samples never appear on the public page. Publishing
order is newest first; add actual dates and links before changing a draft to
published. The static host must serve `writing/index.html` for `/writing`.

## Interactive dot portrait

Open **`dot-art.html`** directly in your browser for the complete, dependency-free
HTML/CSS/JavaScript example. The portrait is also embedded in the **About & Research**
section of `index.html`. It follows the supplied `Friendly Developer at Work.png`:
the wavy hair, smiling face, collared shirt, lanyard, hands, and open laptop.

- `dot-art.html`: minimal exhibition page with the complete inline SVG.
- `dot-art.css`: responsive layout and scoped `.dot-art` component styles.
- `dot-art.js`: configuration, entrance, pointer response, tap ripple, reset, export.
- `assets/dot-portrait.svg`: complete static master artwork with 5,591 portrait marks.
- `assets/dot-portrait-black.svg`: all black paint on warm white.
- `assets/dot-portrait-gray.svg`: graphite gray tones on a light background.
- `assets/dot-portrait-silver.svg`: silver gray tones on charcoal.
- `previews/dot-art-*.png`: browser screenshots of the new example.

The webpage displays 5,200 dots on desktop and 2,600 on mobile. The initial reveal
takes about 1.2 seconds; motion stops when it settles, leaves the viewport, or the
tab is hidden. Touch scrolling remains native. Reduced motion shows a stable
portrait immediately. No animation library, canvas, image fetch, or build step
is required by this component. The existing portfolio has its own external font
and Tailwind dependencies; the new `dot-art.html` example works offline.

The decorative ribbon at the left has been removed. Use the **Earth / Black /
Gray / Silver** controls beneath the portrait to compare colors. **Download SVG**
saves the selected version, with a matching filename. The three separate SVGs
above can also be opened or embedded directly, without JavaScript. Color changes
leave the portrait geometry and motion settings intact.

**Add it to another portfolio:** copy the entire `<figure data-dot-art>` from
`dot-art.html`, including its inline SVG. Copy the CSS, JS, and fallback SVG asset,
then add the following once. Adjust relative paths for your site.

```html
<link rel="stylesheet" href="./dot-art.css">
<script src="./dot-art.js" defer></script>
```

Edit `CONFIG` at the top of `dot-art.js`, or place this before its script tag:

```html
<script>
  window.DOT_ART_CONFIG = {
    density: { desktop: 5200, mobile: 2600 }, // Maximum: 5,591 authored marks.
    palette: ['#CC8A32', '#B64D32', '#E2B64C', '#F2E3C6', '#35251E', '#211E1B'],
    dotSize: 1.3,           // Multiplier of the authored radius.
    interactionRadius: 86, // SVG units; the viewBox is 760 × 860.
    motionStrength: 4.5,
    rippleRadius: 125,
    rippleStrength: 3.8,
    entranceDuration: 1200,
    seed: 271828
  };
</script>
```

Palette order is ochre, terracotta, gold, cream, brown, charcoal; use six hex colors.
The seed controls tiny reveal-timing variations. The portrait geometry is authored
deterministically and remains fixed on reload. Density selects a consistent subset
while retaining key facial and object contours. Changes apply on the next load.

**Reset** restores the resting positions without replaying the entrance.
**Download SVG** saves the currently selected density, palette, and dot size at rest,
including every dot even if clicked during the entrance or a ripple. The file
contains its background, colors, title, description, and paint gradients; it has
no scripts, external assets, or interactive behavior. Without JavaScript, the
inline portrait remains visible and Download SVG links to the static master.

The SVG's accessible title and description convey the subject. If used solely as
decoration beside equivalent content, add `aria-hidden="true"` to that SVG and
remove its `role` and `aria-labelledby`; keep the controls accessible. Add
`data-motion="off"` to the figure to force a static presentation. In an SPA,
dispatch `dot-art:destroy` on the figure before removing it to clean up listeners
and its observer. Each instance has one animation loop and shared SVG gradients,
with spatial buckets limiting pointer work to nearby dots.

The composition draws inspiration from layered dot application in Aboriginal
Australian painting. It is an original digital portrait, not traditional artwork,
a sacred motif, a community story, or a reproduction of an identifiable artist.

For optional authoring, `python tools/build-dot-art.py` recreates the master, its
color variants, and the inline SVGs and color controls in the demo, portfolio, and
static page. The `THEMES` dictionary in that helper defines the color presets.
This helper uses Python's standard library and Windows
System.Drawing to sample the supplied PNG; the cached sample is
`scratch/portrait-rgb.bin`. Remove that cache before rebuilding from a changed PNG.
Run `python tools/build-standalone.py` to refresh the existing bundled portfolio.

The optional `tools/verify-dot-art.mjs` uses Node 22+ and a local headless Chrome
with remote debugging on port 9223. It checks desktop/mobile density, deterministic
geometry, entrance timing, hover and ripple settling, Reset, offscreen suspension,
reduced motion, natural touch scrolling, SVG exports during motion, narrow layouts,
and rendering without JavaScript. Run it with `node tools/verify-dot-art.mjs`;
results are recorded in `previews/dot-art-checks.json`. These are Chromium checks,
not a claim of testing real mobile devices or every browser.

## Original hero notes

The remainder documents the earlier hero deliverable and its separate checks.

A closer, art-directed recreation of the supplied desktop reference. This package
replaces the previous Canvas implementation with fixed SVG artwork. It contains
only the header and hero; it does not redesign or invent the rest of the portfolio.

## Start here

Open `standalone.html` in a browser. Its HTML, CSS, SVG assets, and JavaScript are
bundled together, so no build step or development server is required. Inter is
requested from Google Fonts; the system sans-serif fallback works without a
network connection. No font files are included.

For development, edit `index.html`, `hero.css`, `hero.js`, and the files in `assets/`.
A local server is optional:

```bash
cd abdur-rahman-hero-v2
python -m http.server 8080
```

Open `http://localhost:8080` in your browser. Open `static.html` for a deliberately
motion-free version, independent of the operating system's motion preference.

## Files

```text
index.html                     Editable hero markup
hero.css                       Layout, gradient, typography, responsive states
hero.js                        Signal scheduling and navigation enhancement
static.html                    Forced-static entry; menu still works
standalone.html                All-in-one demo; generated from the source files
assets/
  ai-model-desktop.svg          Six fixed, curved processing sheets
  ai-model-mobile.svg           Separate five-sheet mobile composition
  ai-orbit.svg                 Upper-right extension and sparse ambient dots
previews/
  desktop.png                  Browser-rendered desktop, 1448 x 1086
  mobile.png                   Browser-rendered mobile, 390 CSS pixels wide
  reduced-motion.png           Browser-rendered static state
  mobile-menu.png              Native navigation disclosure, open state
tools/
  build-artwork.py              Optional deterministic artwork authoring helper
  build-standalone.py           Optional single-file bundler
  verify.py                    Optional Playwright regression checks
verification.json              Results and verification limits
```

The screenshots are renders of this implementation, not the supplied mockup.

## What changed

The model's coordinates, sheet widths, vertical offsets, particle distributions,
and flow curves are baked into SVG files. No runtime particle generator is used.
The artwork uses curved dot sheets rather than bordered boxes. Its layout is
fixed; small seeded dot variations are applied only by the optional authoring
script, before export. SVG alone does not guarantee fidelity: the authored
coordinates, proportions, typography, and spacing determine the result.

The desktop artwork has six sheets with sparse, hourglass-shaped connections.
The mobile SVG has its own five-sheet composition instead of a cropped desktop
illustration. An independent upper-right extension preserves the asymmetric
composition. The gradient stays dark behind the writing and transitions to light
under the artwork. All writing, links, and controls remain normal HTML.

This is a coded recreation, not a pixel-identical export of a generated image.
Fonts, browser rasterization, and viewport dimensions can produce small visual
differences.

## Motion behavior

After the illustration becomes visible, the first signal begins after 1.1 seconds.
A pass takes 2.6 seconds, then the controller waits 9 seconds before another pass.
Only a small SVG signal overlay changes; the point-cloud image stays fixed.
There is no continuous requestAnimationFrame polling between passes.

The visible Pause/Resume button freezes the current pass and cancels scheduled
work. The manual choice is remembered in session storage when storage is available.
When less than 5% of the artwork is visible, the document is hidden, or the page
is suspended, the controller cancels its timer and animation frame. Returning to
the page does not override a manual pause. The operating system's reduced-motion
preference always takes precedence and is observed dynamically.

`static.html` uses `data-motion="off"`. The same attribute can be placed on the
hero in `index.html`, or the page can be opened with `?motion=off`. Static mode
hides the animation control, shows a small "Static visual" label, and preserves
the entire illustration. Missing IntersectionObserver also falls back to static.
With JavaScript disabled, the SVG, content, links, and native mobile menu remain.

The only signal path elements are `[data-route]` in `index.html`. If the artwork
is repositioned, update these routes too so the signal follows the new geometry.

## Integrate into your existing portfolio

Copy the hero markup, include `hero.css` and `hero.js` once, and preserve the
relative `assets/` paths. Replace the old Canvas code instead of loading both
versions. Do not nest a second main landmark: if your portfolio already wraps its
content in `<main>`, change this component's `<main class="hero-copy">` into a
`<div class="hero-copy">` and change the closing tag accordingly.

The section navigation deliberately points to the host portfolio's existing IDs:
`work`, `expertise`, `experience`, `about`, and `contact`. Those sections are NOT
provided in this hero-only package. The Explore button expects `id="work"`.
Do not publish the isolated demo as a complete portfolio with unresolved targets.

Before publishing, replace both `YOUR_USERNAME` placeholders with your actual
GitHub and LinkedIn profile IDs. Add your real `resume.pdf` or replace every
`./resume.pdf` link. No resume, profile URL, or project details have been invented.
The credibility text is reproduced from your supplied copy and was not
independently verified.

If a client-side router removes the hero without navigating to a new document,
clean up the controller first:

```js
const hero = document.querySelector('[data-hero]');
hero?.dispatchEvent(new Event('hero:destroy'));
```

Reinitialize the component script when mounting a fresh hero. This package is
plain HTML/CSS/JavaScript, not an already-wired React or Next.js component.

## Editing the artwork

The SVG files can be edited directly. For reproducible changes, edit the named
`DESKTOP` and `MOBILE` coordinate arrays in `tools/build-artwork.py`, then run:

```bash
python tools/build-artwork.py
python tools/build-standalone.py
```

The helper uses only the Python standard library. Visitors do not run Python.
After markup changes, update `static.html` from `index.html` and change its
`data-motion` value to `off`. Rebuild `standalone.html` after source changes.

## Verification and release checks

The supplied report records 36 passing checks in headless Chromium. These cover
12 viewport sizes, from 320 to 1920 CSS pixels wide; no horizontal text/control
clipping; approximately 44-pixel minimum control targets; motion start/pause/
resume; idle RAF cancellation; offscreen handling; reduced-motion changes;
mobile keyboard navigation; cleanup; no-JavaScript rendering; and static fallback.

The browser harness loads the actual bundled HTML without external font requests
and uses installed Inter. The inactive-tab handler is tested with a simulated
visibility event; actual OS background-tab suspension is not claimed as verified.
Safari, Firefox, real mobile devices, host navigation, real profile destinations,
font delivery, and the actual resume still need testing in your deployment.
This is not a formal WCAG conformance audit. Inspect focus visibility and text
contrast again after changing colors, overlays, or typography.

To rerun the optional browser checks:

```bash
pip install playwright
playwright install chromium
python tools/verify.py
```

Set `HERO_CHROMIUM` to a Chromium executable path when necessary. `verify.py`
recreates the previews and `verification.json`. No Playwright dependency is needed
in production. Enable your host's normal gzip/Brotli compression for the SVG,
CSS, and JavaScript files, and test with your site's security policy. A strict
policy must account for the optional Google Fonts stylesheet and font requests;
the standalone entry also contains inline CSS, inline JS, and data-URI images.

## Browser API references

- SVG path sampling: https://developer.mozilla.org/en-US/docs/Web/API/SVGGeometryElement/getPointAtLength
- Visibility observation: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
