"""把 out/review/fNNN.jpg 拼成 3x3 缩略图墙，每格左上角标帧号"""
import pathlib, sys
from PIL import Image, ImageDraw
d = pathlib.Path(sys.argv[1]); fs = sorted(d.glob('f*.jpg'))
W, H, P = 640, 360, 8
for k in range(0, len(fs), 9):
    sheet = Image.new('RGB', (3 * W + 4 * P, 3 * H + 4 * P), 'white')
    for j, f in enumerate(fs[k:k + 9]):
        im = Image.open(f).resize((W, H)); x, y = P + (j % 3) * (W + P), P + (j // 3) * (H + P)
        sheet.paste(im, (x, y)); dr = ImageDraw.Draw(sheet)
        dr.rectangle([x, y, x + 74, y + 34], fill='white'); dr.text((x + 8, y + 6), f.stem[1:], fill='black', font_size=24)
    sheet.save(d / f'sheet{k // 9 + 1:02d}.jpg', quality=85)
