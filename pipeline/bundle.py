"""打包渲染数据：build/timeline.json + build/shots.json + public/img 尺寸 + meta.json → build/props.json

引擎只读这一个文件（remotion render ... --props=<文章目录>/build/props.json）。
用法：python3 pipeline/bundle.py <文章目录>
"""
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(sys.argv[1]).resolve()
B = ROOT / "build"


def size(p):
    with Image.open(p) as im:
        return list(im.size)


images = {p.stem: size(p) for p in sorted((ROOT / "public" / "img").glob("*.png"))}
shots = json.loads((B / "shots.json").read_text())
meta = json.loads((ROOT / "meta.json").read_text())
story = json.loads((ROOT / "script" / "storyboard.json").read_text())
cut = {sc["id"] for sc in story["scenes"] if sc.get("cut")}  # 标了 cut 的镜头：配音里有，成片不播放
timeline = json.loads((B / "timeline.json").read_text())
timeline["scenes"] = [sc for sc in timeline["scenes"] if sc["id"] not in cut]
props = {"timeline": timeline, "images": images,
         "shots": shots["shots"], "steps": shots["steps"],
         "meta": {**meta.get("outro", {}), "qr": "img/qr.jpg" if (ROOT / "public" / "img" / "qr.jpg").exists() else ""}}
(B / "props.json").write_text(json.dumps(props, ensure_ascii=False))
missing = sorted({s["img"] for v in shots["shots"].values() for s in v if s.get("img") and s["img"] not in images})
if missing:
    sys.exit(f"画面安排用到了不存在的图片：{missing}（应放在 public/img/）")
print(f"写入 build/props.json：{len(props['timeline']['scenes'])} 个镜头，{len(images)} 张图" + (f"（剪掉 {len(cut)} 个：{', '.join(sorted(cut))}）" if cut else ""))
