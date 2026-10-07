"""Rebuild the inline SVG portrait from the supplied PNG. Python stdlib + Windows
System.Drawing are used only for authoring; the browser needs HTML/CSS/JS only.
Run from anywhere: python tools/build-dot-art.py
"""
from pathlib import Path
import math
import random
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / 'scratch/portrait-rgb.bin'
if not SAMPLE.exists():
    SAMPLE.parent.mkdir(exist_ok=True)
    subprocess.run(['powershell', '-NoProfile', '-Command', r'''
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::new((Join-Path (Get-Location) 'Friendly Developer at Work.png'))
$sample = [System.Drawing.Bitmap]::new(360,406)
$graphics = [System.Drawing.Graphics]::FromImage($sample)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($source,0,0,360,406)
$bytes = [byte[]]::new(360*406*3)
for ($y=0; $y -lt 406; $y++) { for ($x=0; $x -lt 360; $x++) {
  $c=$sample.GetPixel($x,$y); $i=($y*360+$x)*3
  $bytes[$i]=$c.R; $bytes[$i+1]=$c.G; $bytes[$i+2]=$c.B
} }
[System.IO.File]::WriteAllBytes((Join-Path (Get-Location) 'scratch/portrait-rgb.bin'),$bytes)
$graphics.Dispose(); $sample.Dispose(); $source.Dispose()
'''], cwd=ROOT, check=True)

RGB = SAMPLE.read_bytes()
RNG = random.Random(271828)
PALETTE = ['#CC8A32', '#B64D32', '#E2B64C', '#F2E3C6', '#35251E', '#211E1B']
THEMES = {
    'earth': ('Earth', PALETTE, '#211E1B', '#C1B5A0', 'Earth, warmth & a little curiosity.'),
    'black': ('Black', ['#000000'] * 6, '#FAFAF8', '#555555', 'Black ink on warm white.'),
    'gray': ('Gray', ['#62666C', '#4B4E53', '#82868C', '#A0A4A8', '#34373C', '#24272B'], '#F5F5F3', '#61666C', 'A soft study in graphite.'),
    'silver': ('Silver', ['#B2B7BD', '#8A9098', '#D3D7DB', '#F2F3F4', '#666C74', '#17191D'], '#17191D', '#BDC2C7', 'Silver marks on charcoal.'),
}


def pixel(x, y):
    i = (max(0, min(405, int(y))) * 360 + max(0, min(359, int(x)))) * 3
    return RGB[i:i+3]


def subject(x, y):
    r, g, b = pixel(x, y)
    return not (b > r * 1.25 and r < 46 and g < 61)


def tone(x, y):
    r, g, b = pixel(x, y)
    light = .3*r + .59*g + .11*b
    if b > r * 1.12:  # Recolor the blue lanyard to terracotta.
        return 1 if light > 65 else 4
    if light < 38:
        return 4
    if light < 71:
        return 0 if RNG.random() < .38 else 4
    if r > g * 1.16 and g > b * 1.16:
        if light < 115:
            return 1
        return RNG.choices([0, 1, 2], [70, 13, 17])[0]
    if light > 182:
        return 3 if RNG.random() < .92 else 2
    if light > 137:
        return RNG.choices([0, 2, 3], [33, 38, 29])[0]
    return RNG.choices([0, 2, 4], [68, 13, 19])[0]


def edge(x, y):
    a, b, c, d = pixel(x-1, y), pixel(x+1, y), pixel(x, y-1), pixel(x, y+1)
    return min(1, (sum(abs(a[i]-b[i])+abs(c[i]-d[i]) for i in range(3))) / 200)


# A variable spacing dart distribution follows tonal regions and packs more
# marks around the eyes, smile, hairline, collar, and laptop silhouette.
dots, buckets = [], {}
spacing = 5.5
attempts = 0
while len(dots) < 4500:
    attempts += 1
    if attempts % 40000 == 0:
        spacing *= .94
    x, y = RNG.uniform(6, 354), RNG.uniform(2, 400)
    if not subject(x, y):
        continue
    # Leave deliberate openings for the small, authored facial features below.
    ox, oy = x*1181/360, y*1332/406
    if ((ox-555)/43)**2+((oy-300)/24)**2 < 1 or ((ox-696)/43)**2+((oy-290)/24)**2 < 1:
        continue
    face = 147 < x < 264 and 44 < y < 158
    detail = edge(x, y)
    if RNG.random() > .38 + .42*detail + (.2 if face else 0):
        continue
    px, py = 60 + x*640/360, 38 + y*722/406
    gap = spacing * (.64 if face else 1) * (1 - .2*detail)
    bx, by = int(px//8), int(py//8)
    if any((px-q[0])**2+(py-q[1])**2 < ((gap+q[2])*.5)**2
           for xx in range(bx-1, bx+2) for yy in range(by-1, by+2)
           for q in buckets.get((xx, yy), [])):
        continue
    buckets.setdefault((bx, by), []).append((px, py, gap))
    radius = (1.1 if face else 1.65) * RNG.uniform(.78, 1.23)
    dots.append((px, py, radius, tone(x, y), RNG.uniform(.78, 1), RNG.uniform(.84, 1.15)))

# Seeded order gives every density a complete portrait. Feature details get a
# small priority boost so the mobile composition keeps its expression.
RNG.shuffle(dots)
dots.sort(key=lambda d: RNG.random() - (.18 if 321 < d[0] < 530 and 116 < d[1] < 320 else 0))

# Dotted feature contours are traced from the supplied reference. These are
# ordinary portrait details, and are retained at every responsive density.
details = []


def mark(x, y, radius, color, opacity=.9):
    details.append((60+x*640/1181, 38+y*722/1332, radius*RNG.uniform(.91,1.09),
                    color, opacity, RNG.uniform(.88,1.12)))


def contour(points, color=0, radius=1.05, spacing=6, opacity=.82):
    carry = 0
    for (ax,ay),(bx,by) in zip(points, points[1:]):
        distance = math.hypot(bx-ax, by-ay)
        step = carry
        while step < distance:
            t = step / distance
            mark(ax+(bx-ax)*t, ay+(by-ay)*t, radius, color, opacity)
            step += spacing
        carry = step-distance


# White of each eye, warm iris, and a tiny cream catchlight.
for cx, cy in [(555,300), (697,290)]:
    for yy in range(-16,17,5):
        for xx in range(-32,33,5):
            if (xx/33)**2+(yy/18)**2 < 1:
                color = 3 if ((xx-6)/13)**2+(yy/17)**2 > 1 else 4
                mark(cx+xx+RNG.uniform(-.7,.7),cy+yy+RNG.uniform(-.7,.7),.98,color,.94)
    contour([(cx-34,cy-3),(cx-26,cy-17),(cx-8,cy-23),(cx+15,cy-22),(cx+31,cy-12),(cx+36,cy)],0,.92,5,.9)
    mark(cx+5,cy-7,1.3,3,1)
    mark(cx+10,cy+3,1,0,.9)

# Eyebrows, nose, smile, cheek and jaw: an expressive face at small sizes.
contour([(506,260),(518,251),(538,248),(558,251),(578,260)],4,1.5,4,.98)
contour([(639,254),(658,243),(690,236),(721,239),(746,249)],4,1.5,4,.98)
contour([(599,289),(599,314),(591,343),(586,365),(591,375),(604,382)],1,1.15,5,.95)
contour([(607,379),(620,377),(635,382)],4,1.05,5,.95)
contour([(579,421),(586,425),(614,427),(645,426),(674,422),(693,416)],4,1.2,5,1)
contour([(610,448),(626,452),(643,451)],1,1,6,.9)
contour([(500,297),(510,356),(520,400),(543,447),(582,485),(614,510),(644,516),(688,503),(734,471),(781,426),(808,381)],0,1.1,7,.9)

# Light catches a few locks of the wavy hair; dark gaps separate them.
for points in [
    [(450,238),(434,219),(442,193),(437,163),(454,123),(483,91),(513,78)],
    [(448,88),(466,93),(494,81),(520,53),(553,37),(583,35),(615,24),(650,14)],
    [(486,180),(503,146),(526,124),(560,107),(595,82),(633,61),(669,53)],
    [(504,239),(500,211),(521,218),(540,215),(560,196),(574,165),(589,139),(608,126)],
    [(550,209),(577,202),(592,184),(600,156),(605,127),(621,100),(642,94)],
    [(630,135),(625,114),(630,90),(650,81),(679,84),(701,108),(708,139)],
    [(713,140),(733,112),(767,92),(804,82),(837,88)],
    [(745,166),(756,189),(776,216),(800,238),(815,267),(808,311)],
    [(784,127),(823,126),(854,149),(881,174),(913,162)],
    [(804,177),(848,198),(874,231),(882,266)],
]:
    contour(points,0,1.03,8,.57)

# Collar, lanyard, cuff and laptop outline preserve the working pose.
contour([(578,511),(566,551),(561,586),(592,613),(631,646),(678,600),(735,582),(777,666),(801,612),(835,519),(817,449)],3,1.16,9,.8)
contour([(849,504),(827,611),(795,712),(747,832),(692,950),(659,1022)],1,1.25,8,.85)
contour([(568,619),(580,709),(607,806),(642,904),(657,954)],1,1.16,8,.85)
contour([(136,780),(161,779),(513,798),(541,806),(553,827),(635,1209),(634,1237),(620,1254),(163,1183),(156,1158),(133,803),(136,780)],3,1.08,8,.85)
contour([(643,1244),(686,1247),(843,1181),(851,1159)],0,1.15,8,.9)
contour([(904,1018),(936,988),(972,976),(1010,979),(1041,999),(1065,1034)],3,1.16,8,.8)
contour([(610,1044),(650,1034),(688,1047),(731,1077),(774,1109),(792,1138),(768,1160),(731,1166),(688,1149)],0,1.13,8,.9)

# Keep the authored details first; the seeded tonal field fills remaining dots.
dots = details + dots[:6000-len(details)]


def mix(a, b, amount):
    aa = [int(a[i:i+2], 16) for i in (1,3,5)]
    bb = [int(b[i:i+2], 16) for i in (1,3,5)]
    return '#' + ''.join(f'{round(x+(y-x)*amount):02x}' for x,y in zip(aa,bb))


def render_svg(palette, background):
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 860" width="760" height="860" role="img" aria-labelledby="dot-title dot-description" data-dot-svg>',
       '<title id="dot-title">The maker — a developer at work</title>',
       '<desc id="dot-description">A smiling developer with wavy hair, a collared shirt and lanyard sits behind an open laptop. Thousands of irregular painted dots describe the face, hands and clothing. The background around the figure is clear.</desc>', '<defs>']
    for i, color in enumerate(palette):
        svg.append(f'<linearGradient id="dot-paint-{i}" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="{mix(color, palette[3], .14)}"/><stop offset=".38" stop-color="{color}"/><stop offset="1" stop-color="{mix(color, palette[4], .14)}"/></linearGradient>')
    svg += ['</defs>', f'<rect width="760" height="860" fill="{background}" data-dot-background/>', '<g data-dot-layer>']
    for x,y,r,t,o,ratio in dots:
        svg.append(f'<ellipse cx="{x:.2f}" cy="{y:.2f}" rx="{r:.2f}" ry="{r*ratio:.2f}" fill="url(#dot-paint-{t})" opacity="{o:.2f}"/>')
    svg += ['</g>', '</svg>']
    return '\n'.join(svg)


controls = ['<div class="dot-themes" role="group" aria-label="Portrait color">']
for key, (label, palette, background, note, caption) in THEMES.items():
    filename = 'dot-portrait' + ('' if key == 'earth' else '-'+key) + '.svg'
    art = render_svg(palette, background)
    (ROOT/'assets'/filename).write_text(art, encoding='utf-8')
    controls.append(f'<button type="button" data-dot-theme="{key}" data-dot-palette="{",".join(palette)}" data-dot-background="{background}" data-dot-note="{note}" data-dot-caption="{caption.replace("&", "&amp;")}" data-dot-file="./assets/{filename}" aria-pressed="{str(key == "earth").lower()}" disabled><span style="--swatch:{palette[0]}" aria-hidden="true"></span>{label}</button>')
controls.append('</div>')
art = render_svg(PALETTE, PALETTE[5])
for name in ['dot-art.html', 'index.html', 'static.html']:
    path = ROOT/name
    text = path.read_text(encoding='utf-8')
    for kind, content in [('SVG', art), ('THEMES', '\n'.join(controls))]:
        start, end = f'<!-- DOT-{kind}:START -->', f'<!-- DOT-{kind}:END -->'
        if start in text:
            before, rest = text.split(start, 1)
            _, after = rest.split(end, 1)
            text = before+start+'\n'+content+'\n'+end+after
    path.write_text(text, encoding='utf-8')
print(f'Built {len(dots):,} portrait marks without the ribbon; wrote Earth, Black, Gray and Silver SVGs.')
