#!/usr/bin/env bash
# Article to Video —— 一键安装：Node 依赖、Python 环境（WhisperX 对齐）、NLTK 数据、Gemini Key、品牌信息
# 用法：./install.sh        （可重复运行，已装好的会跳过）
set -euo pipefail
cd "$(dirname "$0")"
say() { printf "\n\033[1;32m▶ %s\033[0m\n" "$1"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

say "1/5 检查基础工具"
command -v node >/dev/null || die "需要 Node.js 18+（macOS: brew install node；其他见 https://nodejs.org）"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js 版本太旧（$(node -v)），需要 18+"
command -v zsh >/dev/null || die "需要 zsh（macOS 自带；Linux: apt install zsh）"
echo "Node $(node -v) ✓"

say "2/5 安装渲染引擎依赖（Remotion）"
(cd engine && npm install --no-audit --no-fund)

say "3/5 创建 Python 环境 .venv（PyTorch + WhisperX 等，约 1 GB，需要几分钟）"
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then
    uv venv -q -p 3.12 .venv
  else
    PYBIN=""
    for c in python3.12 python3.11 python3.10 python3; do
      if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if (3,10) <= sys.version_info[:2] <= (3,12) else 1)'; then PYBIN=$c; break; fi
    done
    [ -n "$PYBIN" ] || die "需要 Python 3.10–3.12（推荐先装 uv：curl -LsSf https://astral.sh/uv/install.sh | sh）"
    "$PYBIN" -m venv .venv
  fi
fi
pipi() { if command -v uv >/dev/null; then uv pip install -q -p .venv/bin/python "$@"; else .venv/bin/pip install -q "$@"; fi; }
# antlr4-python3-runtime 只有源码包，uv 的构建缓存偶尔冲突（File exists），先单独、不用缓存装
if command -v uv >/dev/null; then uv pip install -q -p .venv/bin/python --no-cache antlr4-python3-runtime==4.9.3; fi
pipi -r requirements.txt || { echo "安装失败，不用缓存重试一次…"; if command -v uv >/dev/null; then uv pip install -q -p .venv/bin/python --no-cache -r requirements.txt; else .venv/bin/pip install -q --no-cache-dir -r requirements.txt; fi; }
.venv/bin/python -c "import whisperx, torch, PIL, scipy; print('Python', __import__('sys').version.split()[0], '✓')"

say "4/5 下载 NLTK 分句数据"
.venv/bin/python - <<'PY'
# 直接从 NLTK 官方数据仓库下载（nltk.download 在部分环境会被其安全检查拦截）
import io, pathlib, urllib.request, zipfile
base = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/tokenizers/"
d = pathlib.Path(".venv/nltk_data/tokenizers"); d.mkdir(parents=True, exist_ok=True)
for pkg in ("punkt_tab", "punkt"):
    if not (d / pkg).exists():
        zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(base + pkg + ".zip", timeout=120).read())).extractall(d)
assert (d / "punkt_tab").exists(), "NLTK 数据下载失败"
print("NLTK ✓")
PY

say "5/5 配置"
if [ ! -s .env ] || ! grep -q '^GEMINI_API_KEY=.' .env; then
  if [ -t 0 ]; then
    read -r -s -p "Gemini API Key（https://aistudio.google.com/apikey；直接回车可稍后再填）: " k; echo
    if [ -n "$k" ]; then umask 077; printf 'GEMINI_API_KEY=%s\n' "$k" > .env; echo ".env 已保存（仅本机，不会提交）"; fi
  else
    echo "还没填 Gemini Key：请在你自己的终端里进入本目录运行 ./install.sh（已装好的会跳过，只问 Key），不要把 Key 发到 AI 对话里"
  fi
else
  echo ".env 已存在 ✓"
fi
[ -f brand/brand.json ] || cp brand/brand.example.json brand/brand.json
# 公众号名还没填（空或示例占位文字）时才问；AI 助手的非交互终端里跳过，用户之后在自己终端重跑 ./install.sh 再填
if [ -t 0 ] && .venv/bin/python -c "import json,sys;a=json.load(open('brand/brand.json'))['account'];sys.exit(0 if (not a or '（' in a) else 1)"; then
  read -r -p "片尾显示的公众号 / 频道名（回车跳过）: " acc
  [ -n "$acc" ] && .venv/bin/python -c "import json,sys;p='brand/brand.json';d=json.load(open(p));d['account']=sys.argv[1];json.dump(d,open(p,'w'),ensure_ascii=False,indent=2)" "$acc"
fi
echo "品牌信息在 brand/brand.json；二维码放 brand/qr.jpg（可选）"

say "安装完成 🎉"
cat <<'MSG'
下一步：
  ./a2v new 2026-11-my-topic                       # 新建一篇
  ./a2v fetch articles/2026-11-my-topic <文章链接或 .md 文件>  # 抓取正文和图片
第一次生成配音时，还会自动下载约 1.3 GB 的中文语音对齐模型（只下载一次）。
然后把 WORKFLOW.md 交给你的 AI 助手（Claude Code / Codex …），说「按 Article to Video 流程做这篇」。
MSG
