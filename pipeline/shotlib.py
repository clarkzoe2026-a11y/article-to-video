"""画面安排的公共工具：每篇文章的 shots.py 用它描述“说到哪句话时，画面怎么动”。

在文章目录的 shots.py 里：
    from shotlib import *
    RB = load_redboxes(__file__)          # 截图上作者标注的红框（pipeline/redboxes.py 自动识别）
    SHOTS = {"镜头id": [full(at(0), "002"), zoom(at(3, "关键词"), "003", rb(RB, "003", 0)), ...]}
    write_shots(__file__, SHOTS, step_of_scene={...}, step_names=[...])

触发：at(line, kw) = 说到第 line 句（0 起）的关键词 kw 时切换；kw 省略 = 该句开头。
画面：full 全图 | zoom 先看全图再推近到 rect | spot 全图但只亮 rect（同图连续 spot 时高亮框滑动）
     click=True：推近后光标点击；pop=True：第一张图平滑弹出
面板：code(...) 终端逐行出现 | status([...]) 状态码卡片 | browser(host) 地址栏小锁 | card() 片尾文章卡片
rect：图片内区域 [x, y, w, h]，都是 0~1 的比例
"""
import json
import pathlib


def at(line, kw=None):
    return {"line": line, **({"kw": kw} if kw else {})}


def full(a, img, **kw):
    return {"at": a, "img": img, "mode": "full", **kw}


def zoom(a, img, rect, click=False, cursor=None, **kw):
    """cursor=[x, y]：光标点到框内指定位置（默认点框的中心）"""
    return {"at": a, "img": img, "mode": "zoom", "rect": rect, **({"click": True} if click else {}),
            **({"cursor": cursor} if cursor else {}), **kw}


def spot(a, img, rect, **kw):
    return {"at": a, "img": img, "mode": "spot", "rect": rect, **kw}


def code(a, title, lines, result=None):
    """lines: [{"cmd": "...", "note": "比喻说明", "at": at(...), "mark": at(...)可选}]
    result: {"lines": [...], "ok": "结论", "at": at(...)}"""
    return {"at": a, "code": {"title": title, "lines": lines, **({"result": result} if result else {})}}


def cmd(command, note, a, mark=None):
    return {"cmd": command, "note": note, "at": a, **({"mark": mark} if mark else {})}


def status(a, items):
    """items: [{"code": "200", "text": "一切正常", "at": at(...)}]"""
    return {"at": a, "status": items}


def browser(a, host):
    return {"at": a, "browser": host}


def clip(a, src, start, label=None):
    """剪入一段视频（静音）：src 相对文章 public/（如 "video/demo.mp4"），start 为起始秒"""
    return {"at": a, "clip": {"src": src, "from": start, **({"label": label} if label else {})}}


def stats(a, items):
    """大数字卡片：items = [{"value": 14, "unit": "分钟", "label": "成片", "at": at(...)}]（value 是数字时会从 0 数上去）"""
    return {"at": a, "stats": items}


def flow(a, steps):
    """流程图：steps = [{"name": "抓取", "at": at(...), "gate": True/False}]，gate 显示「你来确认」"""
    return {"at": a, "flow": steps}


def scroll(a, imgs):
    """长图滚动：imgs = ["010", "011", ...] 竖排后匀速上滚，直到下一个画面"""
    return {"at": a, "scroll": {"imgs": imgs}}


def card(a):
    return {"at": a, "card": True}


def cols(n, x0, x1, y0, y1, pad=0.005):
    """把一张横排插画均分成 n 列，返回每列的 rect"""
    w = (x1 - x0) / n
    return [[round(x0 + i * w + pad, 3), y0, round(w - 2 * pad, 3), y1 - y0] for i in range(n)]


def load_redboxes(shots_file):
    p = pathlib.Path(shots_file).resolve().parent / "build" / "redboxes.json"
    return json.loads(p.read_text()) if p.exists() else {}


def rb(RB, img, i):
    if img not in RB or i >= len(RB[img]):
        raise SystemExit(f"图 {img} 没有第 {i} 个红框，请先运行 redboxes 并用 contact 图核对序号")
    return RB[img][i]


def write_shots(shots_file, shots, step_of_scene=None, step_names=None):
    out = pathlib.Path(shots_file).resolve().parent / "build" / "shots.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"shots": shots, "steps": {"ofScene": step_of_scene or {}, "names": step_names or []}},
                              ensure_ascii=False, indent=1))
    print(f"写入 {out.relative_to(out.parent.parent.parent.parent)}：{sum(len(v) for v in shots.values())} 个画面")
