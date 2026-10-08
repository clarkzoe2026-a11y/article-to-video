"""把 script/storyboard.json 渲染成给人审阅的 script/script.md（关卡 1 审稿用）
用法：python3 pipeline/script_md.py <文章目录>
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(sys.argv[1]).resolve()
story = json.loads((ROOT / "script" / "storyboard.json").read_text())
sp = story.get("speakers", {})
names = {"A": "🅰️ 主讲", "B": "🅱️ 提问"}
chars = sum(len(l[1]) for s in story["scenes"] for l in s["lines"])
md = [f"# {story['title']}", "",
      f"*{len(story['scenes'])} 个镜头 · 约 {chars} 字 · 预计 {chars / 5.3 / 60:.1f} 分钟（按 5.3 字/秒）*", "",
      "> " + " · ".join(f"{names.get(k, k)} = {v.get('voice', '')}（{v.get('role', '')}）" for k, v in sp.items()), "",
      "> 审稿：直接改 storyboard.json 的 lines，或告诉 Agent 改哪句；改完重新生成本文件。", ""]
for i, s in enumerate(story["scenes"], 1):
    md += [f"## {i}. {s['title']}" + ("（已剪掉，成片不播放）" if s.get("cut") else ""), f"*画面：{s.get('visual', '')}*", ""]
    md += [f"**{names.get(w, w)}**：{t}" for w, t in s["lines"]] + [""]
(ROOT / "script" / "script.md").write_text("\n".join(md))
print(f"写入 script/script.md：{len(story['scenes'])} 个镜头，{chars} 字")
