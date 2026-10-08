"""用法：python pipeline/redboxes.py <文章目录>
自动识别截图里作者标注的红框，输出每张图的红框坐标（0~1 比例，按从上到下、从左到右排序）"""
import json, glob, os, sys, pathlib
ROOT = pathlib.Path(sys.argv[1]).resolve()  # 文章目录
import numpy as np
from PIL import Image
from scipy import ndimage

def boxes(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    red = (r > 190) & (g < 110) & (b < 110) & (r - g > 110)
    red = ndimage.binary_dilation(red, iterations=2)
    lab, n = ndimage.label(red)
    H, W = red.shape
    out = []
    for sl in ndimage.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        h, w = y1 - y0, x1 - x0
        if w < W * 0.03 or h < H * 0.025:  # 太小：多半是红色数字
            continue
        fill = red[y0:y1, x0:x1].mean()
        if fill > 0.5:  # 实心色块，不是框
            continue
        out.append([round(x0 / W, 3), round(y0 / H, 3), round(w / W, 3), round(h / H, 3)])
    out.sort(key=lambda r: (round(r[1], 1), r[0]))
    return out

res = {}
for p in sorted(glob.glob(str(ROOT / 'public' / 'img' / '*.png'))):
    n = os.path.basename(p)[:3]
    bx = boxes(p)
    if bx:
        res[n] = bx
(ROOT / 'build').mkdir(exist_ok=True)
json.dump(res, open(ROOT / 'build' / 'redboxes.json', 'w'), indent=0)
for k, v in res.items():
    print(k, v)
