"""把四集稿合并成一个完整视频的 storyboard：去掉分集回顾/预告，补上段落间的自然过渡"""
import json, pathlib
from build_scripts import EPISODES, SPEAKERS
HERE = pathlib.Path(__file__).parent
DROP = {"e1_outro", "e2_recap", "e2_outro", "e3_recap", "e3_outro", "e4_recap"}
scenes = [s for ep in EPISODES for s in ep["scenes"] if s["id"] not in DROP]
by = {s["id"]: s for s in scenes}

# 10 步地图结尾：不再说“这一集”
by["e1_map"]["lines"][-1] = ["A", "好，我们一步一步来。先打包家当。"]
# 买服务器结尾：IP 地址留给 DNS 段开头去讲，避免重复
by["e1_step2_server"]["lines"] = by["e1_step2_server"]["lines"][:-1]
# 通水电 → 搬家当
by["e3_clone_url"]["lines"] = [["B", "门牌挂了，门开了，水电也通了，可家当还在云仓库里呢。"],
                               ["A", "对，现在就把家当搬进来。"]] + by["e3_clone_url"]["lines"]
# 测试通过 → 装防盗锁
by["e4_ssl"]["lines"] = [["B", "网站终于能打开了！"],
                         ["A", "能打开了，但大门还没上锁。现在走的是 80 那扇普通大门，数据在路上没加密，我们把它换成带锁的门。"]] + by["e4_ssl"]["lines"]

story = {"title": "AI 建网站不再被平台拿捏：零基础搬上服务器（完整版）", "speakers": SPEAKERS, "scenes": scenes}
(HERE / "full.storyboard.json").write_text(json.dumps(story, ensure_ascii=False, indent=2))
chars = sum(len(l[1]) for s in scenes for l in s["lines"])
print(len(scenes), "个镜头", chars, "字", f"≈{chars / 5.3 / 60:.1f} 分钟")
names = {"A": "🅰️ 主讲", "B": "🅱️ 新手"}
md = [f"# {story['title']}", f"*{len(scenes)} 个镜头 · 约 {chars} 字 · 预计 {chars / 5.3 / 60:.1f} 分钟*", "", "> 🅰️ 主讲 = Callirrhoe · 🅱️ 新手 = Puck", ""]
for i, s in enumerate(scenes, 1):
    md += [f"## {i}. {s['title']}", f"*画面：{s['visual']}*", ""] + [f"**{names[w]}**：{t}" for w, t in s["lines"]] + [""]
(HERE / "script_full.md").write_text("\n".join(md))
