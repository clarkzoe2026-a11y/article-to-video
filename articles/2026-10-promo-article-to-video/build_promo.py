"""宣传片 v2 的数据打包：旁白时间轴 + 公众号文章排版 + 真实产物素材 → build/promo_props.json

宣传片是专门设计的动画（engine/src/promo/Promo.jsx），不走讲解视频的镜头模板。
用法：.venv/bin/python articles/2026-10-promo-article-to-video/build_promo.py
"""
import json
import math
import pathlib
import shutil

from PIL import Image

P = pathlib.Path(__file__).resolve().parent
SRC = P.parents[0] / "2026-10-ai-website-to-server"

# —— 公众号文章排版（宽 720px，与 Promo.jsx 的样式一致；高度按字数估算，宁大勿小）——
W, BODY, LH, HEAD = 720, 26, 1.75, 32


def text_h(text, size, lh):
    units = sum(1.0 if ord(c) > 0x2E80 else 0.56 for c in text)  # 中文按 1 个字宽，英文数字约 0.56
    per = math.floor(W / size)
    return math.ceil(units / per) * size * lh


art = json.loads((P / "build" / "article.json").read_text())
y = 0
y += text_h(art["title"], 40, 1.4) + 18 + 40 + 36  # 标题 + 公众号名一行 + 间距
layout = []
for b in art["blocks"]:
    if b["t"] == "img":
        p = P / "public" / "img" / f"{b['id']}.png"
        if not p.exists():
            continue
        w, h = Image.open(p).size
        bh = W * h / w
        layout.append({**b, "y": round(y), "h": round(bh)})
        y += bh + 28
    elif b["t"] == "h":
        bh = text_h(b["text"], HEAD, 1.5)
        y += 24
        layout.append({**b, "y": round(y), "h": round(bh)})
        y += bh + 20
    else:
        bh = text_h(b["text"], BODY, LH)
        layout.append({**b, "y": round(y), "h": round(bh)})
        y += bh + 22
dns = next(b for b in layout if b["t"] == "h" and "设置 DNS" in b["text"])
fly = next(b for b in layout if b["t"] == "img" and b["id"] == "029")  # 「添加记录」表单（带红框）——飞出到视频

# —— 真实产物截图（第一支成片实际产出）——
for src, dst in [("out/review/c2.jpg", "real_redbox.jpg"), ("out/review/sheet05.jpg", "real_qa.jpg")]:
    shutil.copy(SRC / src, P / "public" / "img" / dst)
script_lines = []
for line in (SRC / "script" / "script_full.md").read_text().splitlines():
    if line.startswith("## 8.") or script_lines:
        script_lines.append(line)
    if len(script_lines) >= 9:
        break

# 痛点段的截图墙：93 张缩略图（只用于宣传片，缩到 320 宽）
thumbs = sorted(p.stem for p in (SRC / "public" / "img").glob("0*.png"))[:93]
(P / "public" / "img" / "thumbs").mkdir(exist_ok=True)
for n in thumbs:
    dst = P / "public" / "img" / "thumbs" / f"{n}.jpg"
    if not dst.exists():
        im = Image.open(SRC / "public" / "img" / f"{n}.png").convert("RGB")
        im.thumbnail((320, 320))
        im.save(dst, quality=82)

# 证明段：第一支成片里每个「画面跟着口播」的触发点（真实时间，用来画 14 分钟同步刻度）
src_props = json.loads((SRC / "build" / "props.json").read_text())


def ats(o, out):
    if isinstance(o, list):
        for x in o:
            ats(x, out)
    elif isinstance(o, dict):
        for k, v in o.items():
            (out.append(v) if k in ("at", "mark") else ats(v, out))
    return out


syncs, off = [], 0.0
for sc in src_props["timeline"]["scenes"]:
    for a in ats(src_props["shots"].get(sc["id"], []), []):
        line = sc["lines"][a["line"]]
        i = line["text"].find(a["kw"]) if a.get("kw") else -1
        syncs.append(round(off + (line["chars"][i] if i >= 0 else line["start"]), 2))
    off += sc["duration"]
film = {"duration": round(off, 2), "syncs": sorted(syncs), "shots": len(src_props["timeline"]["scenes"])}

# 片尾彩蛋：这支宣传片自己的源代码（滚动展示；只取代码文本，不含路径等个人信息）
code = [l.rstrip()[:96] for l in (P.parents[1] / "engine" / "src" / "promo" / "Promo.jsx").read_text().splitlines()
        if l.strip() and "/Users/" not in l][:260]

props = {
    "timeline": json.loads((P / "build" / "timeline.json").read_text()),
    "article": {"title": art["title"], "account": art["account"], "blocks": layout, "height": round(y),
                "dnsY": dns["y"], "fly": {"id": fly["id"], "y": fly["y"], "h": fly["h"]}},
    "scriptExcerpt": script_lines,
    "thumbs": thumbs,
    "film": film,
    "code": code,
}
(P / "build" / "promo_props.json").write_text(json.dumps(props, ensure_ascii=False))
print(f"文章页高 {round(y)}px，DNS 小节 y={dns['y']}，飞出图 029 y={fly['y']} h={fly['h']}；剧本节选 {len(script_lines)} 行；成片 {film['duration']}s，{film['shots']} 个镜头，{len(syncs)} 处同步")
