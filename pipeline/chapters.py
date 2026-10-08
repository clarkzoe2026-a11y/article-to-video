"""生成视频平台（如 B 站）分段章节（发布物料）：按 meta.json 里的 chapters（章节标题 → 起始镜头 id）和时间轴算出时间点
用法：python3 pipeline/chapters.py <文章目录>   → out/chapters.txt
"""
import json
import pathlib
import sys

FPS = 30
ROOT = pathlib.Path(sys.argv[1]).resolve()
scenes = json.loads((ROOT / "build" / "timeline.json").read_text())["scenes"]
chapters = json.loads((ROOT / "meta.json").read_text()).get("chapters", [])
start, t = {}, 0.0
for s in scenes:  # 与引擎一致：每个镜头按帧取整后首尾相接
    start[s["id"]] = t
    t += round(s["duration"] * FPS) / FPS
lines = []
for c in chapters:
    sec = int(start[c["scene"]])
    lines.append(f"{sec // 60:02d}:{sec % 60:02d} {c['title']}")
(ROOT / "out").mkdir(exist_ok=True)
(ROOT / "out" / "chapters.txt").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
