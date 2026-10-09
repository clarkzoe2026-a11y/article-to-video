"""抓取文章正文和图片 → <文章目录>/source/（article.md + images/ + manifest.json），并准备 public/img/

支持：
  - 飞书文档 / 知识库链接（*.feishu.cn）：用飞书官方 lark-cli 只读读取，能拿到高清原图（推荐）
      需先登录：lark-cli auth login --scope "docs:document.content:read docx:document:readonly wiki:node:read wiki:node:retrieve docs:document.media:download"
  - 微信公众号链接（mp.weixin.qq.com）：直接抓网页，图片最宽约 1080px
  - 其他网页文章链接（个人博客、CSDN、掘金、少数派……）：按「阅读模式」算法提取正文和图片
      需要登录才能看、或正文靠浏览器脚本才显示的页面可能抓不全，这时改用本地 Markdown 导入
  - 本地 Markdown / 文本文件（.md / .txt）：文中 ![](图片) 引用的本地图片或网络图片会一起导入
用法：python3 pipeline/fetch_article.py <文章目录> <链接或文件>
"""
import html
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

from PIL import Image

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36"

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
    body = re.search(r'id="js_content"[^>]*>(.*?)</div>\s*<script', page, re.S)  # 跳过该标签剩余属性（如 style="visibility: hidden"）
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


def save_image(i, src, referer=None):
    """下载（或复制本地）第 i 张图 → source/images/NNN.png；太小的图（图标、表情）返回 None"""
    p = IMG / f"{i:03d}.png"
    try:
        if src.startswith(("http://", "https://")):
            req = urllib.request.Request(src, headers={"User-Agent": UA, **({"Referer": referer} if referer else {})})
            p.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        else:
            shutil.copy(src, p)
        to_png(p, p)  # jpg / webp / gif 统一转 png（gif 取第一帧）
        w, h = size(p)
    except Exception as e:
        print(f"  图 {i:03d} 跳过（{type(e).__name__}）：{src[:100]}")
        p.unlink(missing_ok=True)
        return None
    if min(w, h) < 80:
        p.unlink()
        return None
    return {"file": p.name, "w": w, "h": h}


def html_to_md(body, title):
    """正文 HTML → 简单 Markdown：保留标题、段落、列表、代码块和图片位置"""
    def code(m):
        return "\n```\n" + html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip("\n") + "\n```\n"
    text = re.sub(r"<pre[^>]*>(.*?)</pre>", code, body, flags=re.S)
    text = re.sub(r"<img[^>]*src=\"(images/[^\"]+)\"[^>]*>", r"\n![](\1)\n", text)
    text = re.sub(r"<h([1-6])[^>]*>", lambda m: "\n" + "#" * min(int(m.group(1)) + 1, 6) + " ", text)
    text = re.sub(r"<li[^>]*>", "\n- ", text)
    text = re.sub(r"<(br|/p|/div|/section|/h\d|/li|/blockquote)[^>]*>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    lines, fence = [], False
    for l in text.splitlines():
        fence ^= l.strip() == "```"
        if fence or l.strip() == "```" or l.strip():
            lines.append(l.rstrip() if fence else l.strip())
    return f"<title>{title}</title>\n\n" + "\n".join(lines)


def fetch_web(url):
    """其他网页文章：「阅读模式」算法（readability）找正文，再按出现顺序下载正文里的图片"""
    from readability import Document
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9"})
    try:
        raw = urllib.request.urlopen(req, timeout=30)
    except Exception as e:
        sys.exit(f"打不开这个链接（{e}）。如果需要登录才能看，请把文章另存为 Markdown，再用 ./a2v fetch <目录> 文章.md 导入")
    data = raw.read()
    cs = raw.headers.get_content_charset() or (re.search(rb'charset=["\']?([\w-]+)', data[:4000]) or [None, b"utf-8"])[1].decode()
    page = data.decode(cs, "ignore")
    # 懒加载图片：真实地址常放在 data-src / data-original 等属性里，先换到 src，免得被当成空图丢掉
    no_src = re.compile(r'\ssrc="[^"]*"')
    page = re.sub(r'<img([^>]*?)\s(?:data-src|data-original|data-actualsrc|data-lazy-src|data-url)="([^"]+)"',
                  lambda m: "<img" + no_src.sub("", m.group(1)) + ' src="' + m.group(2) + '"', page)
    doc = Document(page)
    body = doc.summary(html_partial=True)
    manifest, n = [], 0
    for m in re.finditer(r'<img[^>]*?src="([^"]+)"[^>]*>', body):
        src = urllib.parse.urljoin(url, html.unescape(m.group(1)))
        if src.startswith("data:"):
            continue
        n += 1
        info = save_image(n, src, referer=url)
        if not info:
            n -= 1
            body = body.replace(m.group(0), "", 1)
            continue
        manifest.append({"n": n, "url": src, **info})
        body = body.replace(m.group(0), f'<img src="images/{info["file"]}">', 1)
    md = html_to_md(body, html.unescape(doc.short_title()))
    if len(re.sub(r"\s|<title>.*?</title>|!\[\]\([^)]*\)", "", md)) < 200:
        sys.exit("这个页面没抓到正文（可能需要登录，或正文靠浏览器脚本才显示）。"
                 "请把文章另存为 Markdown（图片放在同一文件夹），再用 ./a2v fetch <目录> 文章.md 导入")
    return md, manifest


def fetch_local(path):
    """本地 Markdown / 文本：文中 ![](…) 引用的图片（本地相对路径或网络地址）按出现顺序一起导入"""
    p = pathlib.Path(path).expanduser()
    if not p.exists():
        sys.exit(f"找不到文件：{path}\n支持：飞书文档链接、公众号文章链接、其他网页文章链接、本地 .md / .txt 文件")
    md, manifest, n = p.read_text(), [], 0
    for m in list(re.finditer(r"!\[[^\]]*\]\(([^)\s]+)[^)]*\)", md)):
        ref = m.group(1)
        src = ref if ref.startswith(("http://", "https://")) else str((p.parent / urllib.parse.unquote(ref)).resolve())
        info = save_image(n + 1, src)
        if not info:
            continue
        n += 1
        manifest.append({"n": n, "src": ref, **info})
        md = md.replace(m.group(0), f"![](images/{info['file']})", 1)
    return md, manifest


def main():
    # 重新抓取时先清掉上一次抓的图（只删编号图 NNN.*，二维码等其他文件不动），避免新旧文章的图混在一起
    shutil.rmtree(IMG, ignore_errors=True)
    for p in PUB.glob("[0-9][0-9][0-9].png") if PUB.exists() else []:
        p.unlink()
    IMG.mkdir(parents=True, exist_ok=True)
    PUB.mkdir(parents=True, exist_ok=True)
    if "feishu.cn" in SRC or "larksuite.com" in SRC:
        md, manifest = fetch_feishu(SRC)
    elif "mp.weixin.qq.com" in SRC:
        md, manifest = fetch_wechat(SRC)
    elif SRC.startswith(("http://", "https://")):
        md, manifest = fetch_web(SRC)
    else:
        md, manifest = fetch_local(SRC)
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
