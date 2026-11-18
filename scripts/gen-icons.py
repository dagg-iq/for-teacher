"""يولّد أيقونات «مِداد» من الرمز (نفس مقاسات الرمز في LogoMark — viewBox 120)."""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'apps/mobile/assets/images')
SITE = os.path.join(ROOT, 'apps/site')
os.makedirs(OUT, exist_ok=True)

INK = '#111111'; WHITE = '#FFFFFF'; ACCENT = '#4338F0'; ACCENT_DARK = '#8F89FF'

def mark(draw, x0, y0, scale, ink, dot):
    def rr(x, y, w, h):
        draw.rounded_rectangle([x0 + x*scale, y0 + y*scale, x0 + (x+w)*scale, y0 + (y+h)*scale], radius=10*scale, fill=ink)
    rr(16, 22, 88, 20); rr(36, 50, 68, 20); rr(56, 78, 48, 20)
    cx, cy, r = 34, 88, 10
    draw.ellipse([x0+(cx-r)*scale, y0+(cy-r)*scale, x0+(cx+r)*scale, y0+(cy+r)*scale], fill=dot)

def render(size, bg, ink, dot, frac, name, radius=0, ss=4):
    S = size * ss
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        if radius: d.rounded_rectangle([0, 0, S-1, S-1], radius=radius*ss, fill=bg)
        else: d.rectangle([0, 0, S, S], fill=bg)
    box = S * frac
    scale = box / 120
    off = (S - box) / 2
    mark(d, off, off + scale*0, scale, ink, dot)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(name)

render(1024, INK, WHITE, ACCENT_DARK, 0.62, f'{OUT}/icon.png')
render(1024, None, WHITE, ACCENT_DARK, 0.42, f'{OUT}/android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), INK).save(f'{OUT}/android-icon-background.png')
render(1024, None, WHITE, WHITE, 0.42, f'{OUT}/android-icon-monochrome.png')
render(512, None, INK, ACCENT, 0.9, f'{OUT}/splash-icon.png')
render(512, None, '#F2F2F0', ACCENT_DARK, 0.9, f'{OUT}/splash-icon-dark.png')
render(96, INK, WHITE, ACCENT_DARK, 0.66, f'{OUT}/favicon.png', radius=22)
render(96, None, WHITE, WHITE, 0.8, f'{OUT}/notification-icon.png')
os.makedirs(SITE, exist_ok=True)
render(512, INK, WHITE, ACCENT_DARK, 0.62, f'{SITE}/icon-512.png', radius=112)
render(180, INK, WHITE, ACCENT_DARK, 0.62, f'{SITE}/apple-touch-icon.png')
render(64, INK, WHITE, ACCENT_DARK, 0.66, f'{SITE}/favicon.png', radius=14)
print('ok')
