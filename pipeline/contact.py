"""用法：python pipeline/contact.py <文章目录> <输出.jpg> 001,002,003
把一组图片拼成缩略图墙，并标出自动识别的红框序号，供人工核对"""
import json, sys, pathlib
from PIL import Image, ImageDraw
ROOT = pathlib.Path(sys.argv[1]).resolve(); out = sys.argv[2]; ids = sys.argv[3].split(',')
rb = json.load(open(ROOT / 'build' / 'redboxes.json'))
W, H, cols = 600, 380, 3
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + 30)), 'white')
d = ImageDraw.Draw(sheet)
for i, n in enumerate(ids):
    im = Image.open(ROOT / 'public' / 'img' / f'{n}.png').convert('RGB'); im.thumbnail((W - 10, H - 10))
    x, y = (i % cols) * W + 5, (i // cols) * (H + 30) + 28
    sheet.paste(im, (x, y)); d.text((x, y - 26), n, fill='black', font_size=22)
    for k, (bx, by, bw, bh) in enumerate(rb.get(n, [])):
        X, Y = x + bx * im.width, y + by * im.height
        d.rectangle([X, Y, X + bw * im.width, Y + bh * im.height], outline=(0, 160, 255), width=2)
        d.text((X + 2, Y + 1), str(k), fill=(0, 120, 255), font_size=18)
sheet.save(out, quality=85)
