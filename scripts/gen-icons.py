"""يولّد أيقونات «مِداد» من الرمز: قطرة حبر + علامة صح + نقطة طباشير (نفس LogoMark — viewBox 120)."""
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'apps/mobile/assets/images')
SITE = os.path.join(ROOT, 'apps/site')
os.makedirs(OUT, exist_ok=True)

BOARD = '#173A33'; CREAM = '#F5F2EA'; GOLD = '#F2B544'; WHITE = '#FFFFFF'; INK = '#14201D'

def bez(p0, p1, p2, p3, n=60):
    return [tuple((1-t)**3*a + 3*(1-t)**2*t*b + 3*(1-t)*t**2*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3)) for t in (i/n for i in range(n+1))]

def drop_points():
    pts = bez((60, 8), (60, 8), (22, 50), (22, 77))
    pts += [(60 + 38*math.cos(math.radians(a)), 77 + 38*math.sin(math.radians(a))) for a in range(180, -1, -3)]
    pts += bez((98, 77), (98, 50), (60, 8), (60, 8))
    return pts

def mark(d, ox, oy, s, drop, check, dot):
    d.polygon([(ox + x*s, oy + y*s) for x, y in drop_points()], fill=drop)
    w = int(10*s)
    pts = [(43, 77), (55, 89), (78, 64)]
    pts = [(ox + x*s, oy + y*s) for x, y in pts]
    d.line(pts, fill=check, width=w, joint='curve')
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w/2, y - w/2, x + w/2, y + w/2], fill=check)
    d.ellipse([ox + 87*s, oy + 13*s, ox + 105*s, oy + 31*s], fill=dot)

def render(size, bg, drop, check, dot, frac, name, radius=0, ss=4):
    S = size*ss
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        if radius: d.rounded_rectangle([0, 0, S-1, S-1], radius=radius*ss, fill=bg)
        else: d.rectangle([0, 0, S, S], fill=bg)
    box = S*frac; s = box/120; off = (S - box)/2
    mark(d, off, off + s*2, s, drop, check, dot)
    img.resize((size, size), Image.LANCZOS).save(name)

render(1024, BOARD, CREAM, BOARD, GOLD, 0.6, f'{OUT}/icon.png')
render(1024, None, CREAM, BOARD, GOLD, 0.42, f'{OUT}/android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), BOARD).save(f'{OUT}/android-icon-background.png')
# أحادي اللون: القطرة بيضاء والصح مفرّغة
render(1024, None, WHITE, (0, 0, 0, 0), WHITE, 0.42, f'{OUT}/android-icon-monochrome.png')
render(512, None, BOARD, CREAM, GOLD, 0.9, f'{OUT}/splash-icon.png')
render(512, None, CREAM, BOARD, GOLD, 0.9, f'{OUT}/splash-icon-dark.png')
render(96, BOARD, CREAM, BOARD, GOLD, 0.7, f'{OUT}/favicon.png', radius=22)
render(96, None, WHITE, (0, 0, 0, 0), WHITE, 0.8, f'{OUT}/notification-icon.png')
os.makedirs(SITE, exist_ok=True)
render(512, BOARD, CREAM, BOARD, GOLD, 0.6, f'{SITE}/icon-512.png', radius=112)
render(180, BOARD, CREAM, BOARD, GOLD, 0.6, f'{SITE}/apple-touch-icon.png')
render(64, BOARD, CREAM, BOARD, GOLD, 0.7, f'{SITE}/favicon.png', radius=14)
render(1024, BOARD, CREAM, BOARD, GOLD, 0.6, f'{SITE}/og-icon.png')
print('ok')
