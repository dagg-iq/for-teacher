"""يستخرج كلمة «نَهج» (وNahj) مسارات SVG من خطوط ثمانية، بتشكيل عربي صحيح (HarfBuzz)."""
import json, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

def shape(font_path, text, height, rtl=True):
    blob = hb.Blob.from_file_path(font_path)
    face = hb.Face(blob); font = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {})
    tt = TTFont(font_path); gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
    upem = tt['head'].unitsPerEm
    x = 0; parts = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        parts.append((order[info.codepoint], x + pos.x_offset, pos.y_offset)); x += pos.x_advance
    # الحدود
    bp = BoundsPen(gs)
    for name, dx, dy in parts: gs[name].draw(TransformPen(bp, (1, 0, 0, 1, dx, dy)))
    x0, y0, x1, y1 = bp.bounds
    s = height / (y1 - y0)
    pen = SVGPathPen(gs, ntos=lambda v: ('%.2f' % v).rstrip('0').rstrip('.'))
    for name, dx, dy in parts:
        gs[name].draw(TransformPen(pen, (s, 0, 0, -s, (dx - x0) * s, (y1 - dy) * s)))
    return {'d': pen.getCommands(), 'w': round((x1 - x0) * s, 2), 'h': round(height, 2)}

F = 'apps/mobile/assets/fonts/'
out = {
  'ar_display': shape(F + 'thmanyahserifdisplay-Black.otf', 'نَهج', 100),
  'ar_sans': shape(F + 'thmanyahsans-Black.otf', 'نَهج', 100),
  'ar_plain_sans': shape(F + 'thmanyahsans-Black.otf', 'نهج', 100),
  'lat': shape(F + 'thmanyahsans-Bold.otf', 'NAHJ', 40, rtl=False),
}
json.dump(out, open('brand/wordmark.json', 'w'), ensure_ascii=False)
print({k: (v['w'], v['h']) for k, v in out.items()})
