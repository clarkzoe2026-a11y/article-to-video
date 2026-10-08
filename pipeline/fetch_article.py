"""抓取文章正文和图片 → <文章目录>/source/（article.md + images/ + manifest.json），并准备 public/img/

支持：
  - 飞书文档 / 知识库链接（*.feishu.cn）：用飞书官方 lark-cli 只读读取，能拿到高清原图（推荐）
      需先登录：lark-cli auth login --scope "docs:document.content:read docx:document:readonly wiki:node:read wiki:node:retrieve docs:document.media:download"
  - 微信公众号链接（mp.weixin.qq.com）：直接抓网页，图片最宽约 1080px
  - 本地文件（.md / .txt）：只有文字，图片需自己放进 source/images/
用法：python3 pipeline/fetch_article.py <文章目录> <链接或文件>
"""
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.request

from PIL import Image

ROOT = pathlib.Path(sys.argv[1]).resolve()
SRC = sys.argv[2]
OUT = ROOT / "source"
IMG = OUT / "images"
PUB = ROOT / "public" / "img"
MAX_SIDE = 2200  # 超过这个尺寸的大图缩小（再大浏览器渲染容易出空白帧）


def run(*a):
    return subprocess.run(a, capture_output=True, text=True)


def size(p):
    with Image.open(p) as im:
        return im.size


def to_png(src, dst, max_side=None):
    """转成 png；max_side 给定时只缩不放"""
    with Image.open(src) as im:
        im = im.convert("RGBA") if im.mode in ("P", "LA") else im.convert("RGB") if im.mode not in ("RGB", "RGBA") else im
        if max_side and max(im.size) > max_side:
            im.thumbnail((max_side, max_side))
        im.save(dst, "PNG")


def fetch_feishu(url):
    r = run("lark-cli", "docs", "+fetch", "--doc", url, "--as", "user", "--doc-format", "markdown")
    if r.returncode:
        sys.exit("飞书读取失败（是否已 lark-cli auth login？）：" + (r.stdout + r.stderr)[:500])
    md = json.loads(r.stdout)["data"]["document"]["content"]
    tokens = []
    for t in re.findall(r"\]\(https://feishu\.cn/file/([A-Za-z0-9]+)\)", md):
        if t not in tokens:
            tokens.append(t)
    manifest = []
    for i, t in enumerate(tokens, 1):
        r = run("lark-cli", "docs", "+media-download", "--as", "user", "--token", t, "--output", str(IMG / f"{i:03d}"))
        try:
            p = pathlib.Path(json.loads(r.stdout)["data"]["saved_path"])
        except Exception:
            print(f"  图 {i:03d} 下载失败：{r.stdout[:120]}")
            continue
        w, h = size(p)
        manifest.append({"n": i, "token": t, "file": p.name, "w": w, "h": h})
        md = md.replace(f"(https://feishu.cn/file/{t})", f"(images/{p.name})")
    return md, manifest


def fetch_wechat(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/128 Safari/537.36"})
    page = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    title = re.search(r"<h1[^>]*>(.*?)</h1>", page, re.S)
    body = re.search(r'id="js_content"(.*?)</div>\s*<script', page, re.S)
    if not body:
        sys.exit("没找到公众号正文（链接是否需要登录/已被删除？）")
    body = body.group(1)
    manifest = []
    for i, u in enumerate(dict.fromkeys(html.unescape(x) for x in re.findall(r'data-src="([^"]+)"', body)), 1):
        ext = "gif" if "wx_fmt=gif" in u else "png"
        p = IMG / f"{i:03d}.{ext}"
        r = urllib.request.Request(u, headers={"Referer": "https://mp.weixin.qq.com/", "User-Agent": "Mozilla/5.0"})
        p.write_bytes(urllib.request.urlopen(r, timeout=30).read())
        if ext == "png":  # 公众号图片可能是 jpg/webp，统一转 png
            to_png(p, p)
        w, h = size(p)
        manifest.append({"n": i, "url": u, "file": p.name, "w": w, "h": h})
        body = body.replace(u.replace("&", "&amp;"), f"images/{p.name}", 1)
    text = re.sub(r"<img[^>]*src=\"(images/[^\"]+)\"[^>]*>", r"\n![](\1)\n", body)
    text = re.sub(r"<(br|/p|/section|/h\d)[^>]*>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    text = "\n".join(l.strip() for l in text.splitlines() if l.strip())
    t = html.unescape(re.sub(r"<[^>]+>", "", title.group(1))).strip() if title else ""
    return f"<title>{t}</title>\n\n{text}", manifest


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    PUB.mkdir(parents=True, exist_ok=True)
    if "feishu.cn" in SRC or "larksuite.com" in SRC:
        md, manifest = fetch_feishu(SRC)
    elif "mp.weixin.qq.com" in SRC:
        md, manifest = fetch_wechat(SRC)
    else:
        md, manifest = pathlib.Path(SRC).read_text(), []
    (OUT / "article.md").write_text(md)
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    # 渲染用的图：统一 png，编号命名，超大图缩小（只缩不放）
    for m in manifest:
        src, dst = IMG / m["file"], PUB / f"{m['n']:03d}.png"
        if src.suffix == ".png" and max(m["w"], m["h"]) <= MAX_SIDE:
            shutil.copy(src, dst)
        else:
            to_png(src, dst, MAX_SIDE)
    big = sum(1 for m in manifest if m["w"] >= 1920)
    print(f"正文 {len(md)} 字，图片 {len(manifest)} 张（宽 ≥1920 的 {big} 张）→ {OUT}")


if __name__ == "__main__":
    main()
