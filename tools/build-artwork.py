"""Bake fixed, art-directed SVG assets. Run with Python 3; no dependencies.

The layout is authored here, not randomized in the visitor's browser.
Randomness only adds repeatable microscopic dot variation at build time.
"""
from pathlib import Path
import math
import random

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)


def f(n):
    return f'{n:.2f}'.rstrip('0').rstrip('.')


def dot(x, y, r, a=1, color=None):
    fill = f' fill="{color}"' if color else ''
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" opacity="{f(a)}"{fill}/>'


def path(d, opacity=.2, width=.7, color='#dce7ff'):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity="{f(opacity)}" stroke-width="{f(width)}"/>'


def point(layer, u, v):
    x, y, w, h, skew, bend = layer
    return (x + u*w + bend*(math.cos(v*math.pi)-.68),
            y + v*h - u*skew + 3*math.sin(u*math.pi)*math.cos(v*math.pi))


def segment(a, b, bend=0):
    dx = b[0]-a[0]
    return f'M{f(a[0])} {f(a[1])}C{f(a[0]+dx*.43)} {f(a[1]+bend)} {f(b[0]-dx*.44)} {f(b[1]-bend)} {f(b[0])} {f(b[1])}'


def bez(t, p0, p1, p2, p3):
    q=1-t
    return (q*q*q*p0[0]+3*q*q*t*p1[0]+3*q*t*t*p2[0]+t*t*t*p3[0],
            q*q*q*p0[1]+3*q*q*t*p1[1]+3*q*t*t*p2[1]+t*t*t*p3[1])


DESKTOP = [
    (426,146,80,236,46,10),
    (566,169,77,244,56,-9),
    (704,195,67,244,60,9),
    (843,217,67,224,57,-8),
    (957,224,56,204,48,7),
    (1047,229,42,166,38,-4),
]
MOBILE = [
    (129,133,35,142,24,4),
    (188,147,32,142,27,-4),
    (245,159,31,134,25,4),
    (300,168,27,119,24,-3),
    (348,175,23,99,20,3),
]


def model(mobile=False):
    rng = random.Random(1907 if mobile else 2026)
    W,H=(420,310) if mobile else (1448,420)
    layers=MOBILE if mobile else DESKTOP
    cx,cy,rx,ry=(53,112,45,52) if mobile else (184,118,135,98)
    ox,oy,orx,ory=(393,177,20,19) if mobile else (1290,218,106,41)
    nodes=[]
    for i in range(86 if mobile else 260):
        a=rng.random()*math.tau
        r=rng.random()**.63
        x=cx+math.cos(a)*r*rx
        y=cy+math.sin(a)*r*ry
        radius=(.6+rng.random()*1.1) if mobile else (.65+rng.random()*1.95)
        alpha=.25+rng.random()*.65
        nodes.append((x,y,radius,alpha))
    out=[]
    for i in range(30 if mobile else 83):
        a=rng.random()*math.tau
        r=rng.random()**.62
        x=ox+math.cos(a)*r*orx
        y=oy+math.sin(a)*r*ory
        out.append((x,y,(.8+rng.random()*1.3) if mobile else (1+rng.random()*2.4),.4+rng.random()*.52))
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" fill="#ecf2ff"><title>Abstract model-processing point cloud</title>',
           '<defs><radialGradient id="halo"><stop stop-color="#e8f1ff" stop-opacity=".5"/><stop offset="1" stop-color="#a2baff" stop-opacity="0"/></radialGradient></defs>']
    # Ground-plane depth is sparse and static, not a moving star field.
    for i in range(190 if mobile else 850):
        x=rng.uniform(10,W-10)
        y=rng.uniform(H*.65,H*.96)
        weight=max(0,1-abs(x/W-.52)*1.85)
        parts.append(dot(x,y,rng.uniform(.35,.75),rng.uniform(.035,.22)*weight))
    for i in range(4 if mobile else 7):
        y=H*(.73+i*.03)
        parts.append(path(f'M0 {f(y)}Q{f(W*.52)} {f(y+H*.23)} {W} {f(y-H*.1)}',.035,.6))
    # Each strand connects only neighbouring sheets, not every node to every node.
    strands=17 if mobile else 36
    for j in range(strands):
        v=(j/(strands-1)-.5)*.77
        u=math.sin(j*.71)*.32
        start=(cx+rx*.28,cy+v*ry*1.8)
        entry=point(layers[0],-.48,v)
        parts.append(path(segment(start,entry,math.sin(j*.26)*(5 if mobile else 30)),.13+(j%4)*.027,.48 if mobile else .7))
        for k in range(len(layers)-1):
            a=point(layers[k],u,v)
            b=point(layers[k+1],-u,v+math.sin(j*.31+k)*.028)
            dx=b[0]-a[0]
            control_a=a[1]*.50+layers[k][1]*.50
            control_b=b[1]*.50+layers[k+1][1]*.50
            d=f'M{f(a[0])} {f(a[1])}C{f(a[0]+dx*.45)} {f(control_a)} {f(b[0]-dx*.45)} {f(control_b)} {f(b[0])} {f(b[1])}'
            parts.append(path(d,.13+(j%5)*.026,.43 if mobile else .72))
        a=point(layers[-1],.3,v)
        b=(ox-orx*.14,oy+v*ory*1.65)
        parts.append(path(segment(a,b,-5 if mobile else -18),.17,.48 if mobile else .75))
    # Cloud detail: short local connections keep the input/output architectural.
    for cloud in (nodes,out):
        for i,p in enumerate(cloud):
            if i%2: continue
            closest=sorted((q for q in cloud if q is not p),key=lambda q:(p[0]-q[0])**2+(p[1]-q[1])**2)[:2]
            for q in closest:
                if math.hypot(p[0]-q[0],p[1]-q[1]) < (22 if mobile else 53):
                    parts.append(path(f'M{f(p[0])} {f(p[1])}L{f(q[0])} {f(q[1])}',.14,.5))
    for cloud in (nodes,out):
        for i,(x,y,r,a) in enumerate(cloud):
            if i%13==0:
                parts.append(dot(x,y,r*4.8,.65,'url(#halo)'))
            parts.append(dot(x,y,r,a))
    # Warped point sheets: no boxes, polygons, or filled rectangular panels.
    for k,layer in enumerate(layers):
        cols=(8 if mobile else max(10,16-k))
        rows=(24 if mobile else 46-k*2)
        parts.append(f'<g id="processing-layer-{k+1}">')
        for c in range(cols):
            u=c/(cols-1)-.5
            for r in range(rows):
                v=r/(rows-1)-.5
                x,y=point(layer,u,v)
                x+=rng.uniform(-.27,.27);y+=rng.uniform(-.32,.32)
                edge=1-c/(cols-1)
                radius=(.56+rng.random()*.32+edge*.25) if mobile else (.68+rng.random()*.47+edge*.42)
                alpha=.39+.34*edge+rng.random()*.24
                parts.append(dot(x,y,radius,alpha))
        parts.append('</g>')
    # A few foreground pins produce depth without blurring the entire scene.
    for x,y,r in ([(40,91,1.3),(77,129,1.8),(395,168,1.5)] if mobile else [(165,66,3.7),(218,123,3.4),(1258,195,3.8),(1311,222,4),(120,143,3.0)]):
        parts.append(dot(x,y,r*4,.6,'url(#halo)'))
        parts.append(dot(x,y,r,.98))
    parts.append('</svg>')
    name='ai-model-mobile.svg' if mobile else 'ai-model-desktop.svg'
    (ASSETS/name).write_text('\n'.join(parts),encoding='utf-8')


def orbit():
    rng=random.Random(94)
    W,H=1448,950
    a,b,c,d=(785,745),(1110,650),(1300,345),(1440,78)
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" fill="#abc3ff"><title>Decorative inference extension</title><defs><radialGradient id="halo"><stop stop-color="#e4eeff" stop-opacity=".7"/><stop offset="1" stop-color="#809eff" stop-opacity="0"/></radialGradient></defs>']
    for i in range(9):
        v=(i-4)*8
        parts.append(path(f'M{785+v} 745C{1110+v} {650+v} {1300+v} {345+v} {1440+v} 78',.07,.65,'#8ba8ff'))
    for i in range(1420):
        t=rng.random()
        x,y=bez(t,a,b,c,d)
        spread=(20+20*math.sin(t*math.pi))
        x+=rng.gauss(0,spread);y+=rng.gauss(0,spread*.52)
        parts.append(dot(x,y,.3+rng.random()*.75,.12+rng.random()*.43))
    for t in [.18,.3,.43,.56,.68,.82,.93]:
        x,y=bez(t,a,b,c,d)
        parts.append(dot(x,y,12,.68,'url(#halo)'))
        parts.append(dot(x,y,2.2+rng.random(),.9,'#e3edff'))
    # Background field remains quiet under the central text.
    for i in range(170):
        x=rng.uniform(10,1438);y=rng.uniform(38,810)
        central=(340<x<1060 and y<500)
        parts.append(dot(x,y,.5+rng.random()*.5,.045 if central else rng.uniform(.12,.4),'#7996ff'))
    parts.append('</svg>')
    (ASSETS/'ai-orbit.svg').write_text('\n'.join(parts),encoding='utf-8')

if __name__=='__main__':
    model();model(True);orbit()
    for p in ASSETS.glob('*.svg'):
        print(f'{p.name}: {p.stat().st_size:,} bytes')
