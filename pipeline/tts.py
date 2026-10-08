"""按“段落组”生成双人对话配音：storyboard.json → public/audio/chunk_NN.wav + chunks.json

免费版 Gemini TTS 每天只有 10 次调用，按镜头调用很快用完。这里把相邻镜头拼成约 4 分钟一组，
每组调用一次（整片约 5 次），之后由 align.py 按逐字时间戳切回各镜头。
台词没改的组会跳过。Key 从 .env 读取（GEMINI_API_KEY=...）。
用法：python3 pipeline/tts.py <文章目录> [--force] [--sample 字数] [--chunk-chars 字数]
  --sample 300：只生成开头约 300 字的试听段（public/audio/sample.wav），用于【关卡 2a 试听确认】，不覆盖正式配音
"""
import base64
import hashlib
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request

PROJECT = pathlib.Path(__file__).resolve().parent.parent
ROOT = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else sys.exit("用法：tts.py <文章目录> ...")
AUDIO = ROOT / "public" / "audio"
MODEL = "gemini-3.8-flash-tts"
URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
CHUNK_CHARS = 100000  # 默认整片一组：只调用 1 次（用户要求优先免费版、尽量一次生成）

STYLE_A = (
    "（女声主讲）像懂行的朋友，给完全不懂技术的成年人自然解释。语气亲切、克制，不刻意播音；"
    "语速比日常聊天稍快、节奏紧凑（大约每秒五到六个字），句间停顿短而自然，清楚的语义分组和轻微重点强调，保留自然呼吸与停顿。举例时放松，结论处自然收住。英文词（产品名、命令等）按自然的英文发音读，和前后中文连贯，不要逐个字母拼读、不要突然变调。"
    "不要新闻播音腔、广告腔、客服腔、儿童故事腔，也不要机械逐字念稿。不要增删或改写文字。"
)
STYLE_B = "（男声提问者，始终保持男声）好奇、轻松的提问者，像在听朋友讲新东西，会自然地接话、恍然大悟。语速稍快、接话利落，不拖音。普通话自然，不夸张。英文词按自然的英文发音读，和中文连贯。不要增删或改写文字。"


def api_key():
    env = PROJECT / ".env"
    if not env.exists():
        sys.exit("项目根目录缺少 .env（内容：GEMINI_API_KEY=...），见 README")
    for line in env.read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit(".env 里没有 GEMINI_API_KEY")


def make_chunks(scenes):
    """相邻镜头贪心拼组，单组不超过 CHUNK_CHARS 字"""
    chunks, cur, n = [], [], 0
    for s in scenes:
        c = sum(len(t) for _, t in s["lines"])
        if cur and n + c > CHUNK_CHARS:
            chunks.append(cur)
            cur, n = [], 0
        cur.append(s["id"])
        n += c
    if cur:
        chunks.append(cur)
    return chunks


# 生成时让模型“记住两个角色”：请求里的说话人名直接带上身份和性别，每一句都标注是谁在说
SPEAKER = {"A": "主讲·女", "B": "提问·男"}
VOICE = {"A": "Callirrhoe", "B": "Puck"}


def synth(lines, key, label):
    if len({who for who, _ in lines}) == 1:  # 只有一个角色（如宣传片旁白）：单人模式整段生成
        who = lines[0][0]
        return call_tts({"model": MODEL,
                         "input": [{"type": "user_input", "content": [{"type": "text", "text": "\n".join(t for _, t in lines),
                                    "annotations": [{"type": "speech_metadata", "style": STYLE_A if who == "A" else STYLE_B}]}]}],
                         "response_format": {"type": "audio", "mime_type": "audio/wav", "sample_rate": 24000},
                         "generation_config": {"speech_config": [{"voice": VOICE[who]}]}}, key, label)
    content = [{
        "type": "text", "text": text,
        "annotations": [{"type": "speech_metadata", "speaker": SPEAKER[who],
                         "style": STYLE_A if who == "A" else STYLE_B}],
    } for who, text in lines]
    payload = {
        "model": MODEL,
        "input": [{"type": "user_input", "content": content}],
        "response_format": {"type": "audio", "mime_type": "audio/wav", "sample_rate": 24000},
        "generation_config": {"speech_config": {"speakers": [
            {"speaker": SPEAKER[k], "voice": VOICE[k]} for k in ("A", "B")
        ]}},
    }
    return call_tts(payload, key, label)


def call_tts(payload, key, label):
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(),
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                resp = json.load(r)
            break
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:600]
            if e.code in (500, 503) and attempt < 5:
                wait = 20 * (attempt + 1)
                print(f"[{label}] 服务繁忙（{e.code}），{wait} 秒后重试…", flush=True)
                time.sleep(wait)
                continue
            sys.exit(f"[{label}] API 错误 {e.code}: {body}")
    audios = [c for s in resp.get("steps", []) if s.get("type") == "model_output"
              for c in s.get("content", []) if c.get("type") == "audio"]
    if not audios:
        sys.exit(f"[{label}] 响应里没有音频")
    return base64.b64decode(audios[-1]["data"])


def main():
    args = sys.argv[2:]
    force = "--force" in args
    only = set()
    if "--sample" in args:  # 试听段：只取开头若干字，单独存，不影响正式配音
        limit = int(args[args.index("--sample") + 1])
        lines, n = [], 0
        for s in json.loads((ROOT / "script" / "storyboard.json").read_text())["scenes"]:
            for l in s["lines"]:
                if n >= limit:
                    break
                lines.append(l); n += len(l[1])
        AUDIO.mkdir(parents=True, exist_ok=True)
        data = synth(lines, api_key(), "试听")
        (AUDIO / "sample.wav").write_bytes(data)
        secs = (len(data) - 44) / 2 / 24000
        print(f"试听段：{n} 字，{secs:.1f} 秒，{n / secs:.2f} 字/秒 → {AUDIO / 'sample.wav'}")
        return
    story = json.loads((ROOT / "script" / "storyboard.json").read_text())
    # 文章可在 storyboard.json 里用 "style": {"A": "...", "B": "..."} 覆盖默认讲解风格（如宣传片要更快、更利落）
    global STYLE_A, STYLE_B
    STYLE_A = story.get("style", {}).get("A", STYLE_A)
    STYLE_B = story.get("style", {}).get("B", STYLE_B)
    by = {s["id"]: s for s in story["scenes"]}
    chunks = make_chunks(story["scenes"])
    AUDIO.mkdir(parents=True, exist_ok=True)
    manifest = []
    key = None
    if "--chunk-chars" in args:
        global CHUNK_CHARS
        CHUNK_CHARS = int(args[args.index("--chunk-chars") + 1])
        chunks = make_chunks(story["scenes"])
    for i, ids in enumerate(chunks, 1):
        lines = [l for sid in ids for l in by[sid]["lines"]]
        digest = hashlib.sha1(json.dumps([MODEL, STYLE_A, STYLE_B, lines], ensure_ascii=False).encode()).hexdigest()
        wav, stamp = AUDIO / f"chunk_{i:02d}.wav", AUDIO / f"chunk_{i:02d}.sha1"
        manifest.append({"chunk": i, "audio": wav.name, "scenes": ids})
        label = f"组{i:02d}"
        if not force and wav.exists() and (AUDIO / "approved.json").exists():
            print(f"[{label}] 这份配音已由用户确认（approved.json），不重新生成；确需重做请加 --force")
            continue
        if (only and i not in only) or (not force and wav.exists() and stamp.exists() and stamp.read_text() == digest):
            print(f"[{label}] 台词未变，跳过（{len(ids)} 个镜头）")
            continue
        key = key or api_key()
        print(f"[{label}] 生成中…（{len(ids)} 个镜头，{sum(len(t) for _, t in lines)} 字）", flush=True)
        data = synth(lines, key, label)
        wav.write_bytes(data)
        chars = sum(len(t) for _, t in lines)
        secs = (len(data) - 44) / 2 / 24000
        print(f"[{label}] 音频 {secs:.1f} 秒，{chars / secs:.2f} 字/秒", flush=True)
        if chars / secs > 6.5:
            sys.exit(f"[{label}] 音频明显偏短，疑似被截断。请改用分组：python3 pipeline/tts.py --chunk-chars 2400")
        stamp.write_text(digest)
    (AUDIO / "chunks.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"完成，共 {len(chunks)} 组")


if __name__ == "__main__":
    main()
