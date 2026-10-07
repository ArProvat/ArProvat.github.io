"""Optional regression check. Requires Playwright and an installed Chromium.

Run: pip install playwright; playwright install chromium; python tools/verify.py
This inline harness avoids external network requests and uses available system
fonts. A real-device/browser and deployed-link review remains a release step.
"""
from pathlib import Path
import json
import re
import os
import shutil
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
HTML=(ROOT/'standalone.html').read_text(encoding='utf-8')
HTML=re.sub(r'<link[^>]+(?:fonts.googleapis.com|fonts.gstatic.com)[^>]*>', '', HTML)
RESULTS=[]


def check(name, value, detail=None):
    result={'test':name,'passed':bool(value)}
    if detail is not None: result['detail']=detail
    RESULTS.append(result)
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    if not value: raise AssertionError(f'{name}: {detail}')


def state(page):
    return page.locator('[data-hero]').get_attribute('data-motion-state')


def load(page, html=HTML):
    page.set_content(html,wait_until='load',timeout=15000)
    # No external font fetches in this harness; installed fonts are synchronous.
    page.wait_for_timeout(100)


with sync_playwright() as p:
    executable=os.environ.get('HERO_CHROMIUM') or shutil.which('chromium')
    browser=p.chromium.launch(executable_path=executable,headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1448,'height':1086},device_scale_factor=1)
    page=context.new_page()
    page.set_default_timeout(6000)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    # Observe scheduler work without altering timing or visibility behavior.
    page.evaluate('''() => {
      const request = window.requestAnimationFrame.bind(window);
      const cancel = window.cancelAnimationFrame.bind(window);
      window.__frames = {pending: new Set(), calls: 0};
      window.requestAnimationFrame = callback => {
        const id = request(t => {__frames.pending.delete(id); __frames.calls++; callback(t)});
        __frames.pending.add(id); return id;
      };
      window.cancelAnimationFrame = id => {__frames.pending.delete(id); cancel(id)};
    }''')
    load(page)
    for width,height in [(320,568),(360,800),(375,812),(390,844),(430,932),(600,900),(768,1024),(900,700),(1024,768),(1280,800),(1448,1086),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(60)
        layout=page.evaluate('''() => {
          const controls=[...document.querySelectorAll('.hero a, .hero button, .hero summary')]
            .filter(e=>e.checkVisibility());
          return {
            viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            clippedControls: controls.filter(e=>{const r=e.getBoundingClientRect();return r.x < -1 || r.right > innerWidth+1}).map(e=>e.textContent.trim()),
            smallControls: controls.filter(e=>{const r=e.getBoundingClientRect();return r.height<43.5 || r.width<43.5}).map(e=>e.textContent.trim()),
            textClipping: [...document.querySelectorAll('.hero-title, .hero-description, .eyebrow, .credibility')].some(e=>e.scrollWidth>e.clientWidth+1)
          };
        }''')
        check(f'Layout at {width}x{height}',layout['scrollWidth']==width and not layout['clippedControls'] and not layout['smallControls'] and not layout['textClipping'],layout)
    page.set_viewport_size({'width':1448,'height':1086})
    page.wait_for_timeout(100)
    # Capture a settled screenshot with a visible pause control and no passing signal.
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(40)
    page.screenshot(path=str(OUT/'reduced-motion.png'),full_page=True)
    check('Reduced motion stops scheduler',state(page)=='reduced' and page.evaluate('__frames.pending.size')==0)
    check('Reduced motion preserves full artwork',page.locator('.model-art img').is_visible())
    page.emulate_media(reduced_motion='no-preference')
    page.wait_for_timeout(850)
    page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    page.wait_for_timeout(650)
    check('Signal begins',state(page)=='running',state(page))
    before=page.locator('.signal-desktop [data-head]').get_attribute('transform')
    page.wait_for_timeout(150)
    after=page.locator('.signal-desktop [data-head]').get_attribute('transform')
    check('Only signal position advances',before!=after)
    page.locator('[data-motion-control]').click()
    paused=page.locator('.signal-desktop [data-head]').get_attribute('transform')
    page.wait_for_timeout(220)
    check('Pause freezes signal and cancels RAF',state(page)=='paused' and paused==page.locator('.signal-desktop [data-head]').get_attribute('transform') and page.evaluate('__frames.pending.size')==0)
    check('Resume label reflects pause',page.locator('[data-motion-label]').inner_text()=='Resume motion')
    page.locator('[data-motion-control]').click()
    page.wait_for_timeout(150)
    check('Resume advances signal',state(page)=='running' and paused!=page.locator('.signal-desktop [data-head]').get_attribute('transform'))
    page.wait_for_timeout(2900)
    n=page.evaluate('__frames.calls')
    page.wait_for_timeout(250)
    check('No RAF polling between passes',state(page)=='idle' and page.evaluate('__frames.pending.size')==0 and n==page.evaluate('__frames.calls'))
    # Add a test-only host section so the hero can leave the viewport.
    page.evaluate("document.body.insertAdjacentHTML('beforeend','<div style=\"height:1600px\" data-test-spacer></div>');window.scrollTo({top:1300,behavior:\"instant\"})")
    page.wait_for_timeout(150)
    check('Offscreen stops work',state(page)=='offscreen' and page.evaluate('__frames.pending.size')==0)
    page.evaluate('window.scrollTo({top:0,behavior:\"instant\"})')
    page.wait_for_timeout(120)
    check('Re-entering viewport restores eligibility',state(page)=='idle')
    # Explicitly simulated: headless sessions do not reproduce real OS tab suspension.
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(50)
    check('Visibility handler - simulated inactive tab',state(page)=='inactive' and page.evaluate('__frames.pending.size')==0)
    page.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(50)
    check('Visibility handler - simulated return',state(page)=='idle')
    page.evaluate("document.querySelector('[data-test-spacer]').remove()")
    # Mobile navigation, keyboard focus, and responsive artwork.
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(80)
    check('Separate mobile SVG is active',page.evaluate("document.querySelector('.model-art img').naturalWidth===420") and page.locator('.signal-mobile').is_visible() and not page.locator('.signal-desktop').is_visible())
    page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    summary=page.locator('.mobile-menu summary')
    summary.click()
    check('Mobile menu opens',page.locator('.mobile-menu').get_attribute('open') is not None)
    page.screenshot(path=str(OUT/'mobile-menu.png'),full_page=True)
    page.keyboard.press('Escape')
    check('Escape closes menu and restores focus',page.locator('.mobile-menu').get_attribute('open') is None and summary.evaluate('(e)=>e===document.activeElement'))
    summary.focus()
    page.keyboard.press('Enter')
    check('Keyboard opens native menu',page.locator('.mobile-menu').get_attribute('open') is not None)
    page.mouse.click(12,400)
    check('Outside click closes menu',page.locator('.mobile-menu').get_attribute('open') is None)
    # User pause remains sticky through changes in visibility / viewport.
    page.locator('[data-motion-control]').click()
    page.set_viewport_size({'width':1280,'height':800})
    page.wait_for_timeout(80)
    check('Viewport change never overrides manual pause',state(page)=='paused')
    check('No runtime exceptions',not errors,errors)
    # Verify final cleanup removes work and observers.
    page.locator('[data-motion-control]').click()
    page.evaluate("document.querySelector('[data-hero]').dispatchEvent(new Event('hero:destroy'))")
    page.wait_for_timeout(100)
    check('SPA cleanup cancels pending RAF',page.evaluate('__frames.pending.size')==0)
    context.close()
    # Javascript-disabled rendering and native disclosure menu.
    nojs=browser.new_context(viewport={'width':390,'height':844},java_script_enabled=False)
    page=nojs.new_page()
    load(page)
    page.wait_for_timeout(750)
    check('No-JS headline, artwork, and CTA remain visible',page.locator('.hero-title').is_visible() and page.locator('.model-art img').is_visible() and page.locator('.button-primary').is_visible())
    page.locator('.mobile-menu summary').click()
    check('No-JS mobile navigation works',page.locator('.mobile-menu').get_attribute('open') is not None)
    nojs.close()
    # Forced static mode, independent of OS preference.
    context=browser.new_context(viewport={'width':1448,'height':1086})
    page=context.new_page()
    page.set_default_timeout(6000)
    load(page,HTML.replace('data-motion="auto"','data-motion="off"'))
    page.wait_for_timeout(1300)
    check('Forced static entry never starts signal',state(page)=='static' and not page.locator('[data-motion-control]').is_visible())
    # Browser fallback: no IO means static, not an unobserved animation loop.
    page=context.new_page()
    page.set_default_timeout(6000)
    page.evaluate('window.IntersectionObserver=undefined;delete window.IntersectionObserver')
    load(page)
    page.wait_for_timeout(150)
    check('Missing IntersectionObserver fails static',state(page)=='static')
    context.close()
    browser.close()

report={
    'browser':'Headless Chromium',
    'harness':'Inline standalone HTML; SVG and CSS are the delivered assets. External font requests removed; installed Inter used.',
    'limitations':['Not a WCAG conformance audit.','Safari, Firefox, real mobile hardware, and real background-tab suspension not tested.','Profile URLs, resume, and host section targets require user configuration.'],
    'passed':sum(r['passed'] for r in RESULTS),
    'checks':RESULTS,
}
(ROOT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':report['passed'],'checks':len(RESULTS)},indent=2))
