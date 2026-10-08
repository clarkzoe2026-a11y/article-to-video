"""逐字对齐 + 切分：public/audio/chunk_NN.wav → public/audio/<scene>.wav + src/timeline.json

每组音频较长（约 4 分钟），整段做强制对齐内存会爆，所以用滑动窗口：每次对齐二三十秒的几句台词，
窗口最后一句留到下一个窗口重新对齐（避免窗口边界把最后一个字拉长）。
对齐后在相邻镜头之间的停顿里切开（切点由波形定：在两句之间找最安静的位置，不按对齐时间机械取中点），写出每个镜头的音频和逐字时间。
用法：<whisperx venv>/bin/python pipeline/align.py <文章目录>
"""
import json
import math
import sys
import os
import pathlib
import wave

os.environ.setdefault("NLTK_DATA", str(pathlib.Path(__file__).resolve().parents[1] / ".venv" / "nltk_data"))
import numpy as np  # noqa: E402
import whisperx  # noqa: E402
from scipy.signal import resample_poly  # noqa: E402

ROOT = pathlib.Path(sys.argv[1]).resolve()
AUDIO = ROOT / "public" / "audio"
SR = 24000
RATE = 5.0  # 估算语速（字/秒），只用于确定窗口大小
WINDOW_CHARS = 110  # 每个窗口大约对齐多少字
END_TAIL = 0.8  # 全片最后留白


def read_wav(path):
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2 and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)


def write_wav(path, samples):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(samples.astype(np.int16).tobytes())


def char_times(text, t0, t1, audio16, model, meta):
    """对齐 text 到 [t0, t1] 区间，返回每个字的 (start, end)，没对上的为 None"""
    res = whisperx.align([{"start": t0, "end": t1, "text": text}], model, meta, audio16, "cpu",
                         return_char_alignments=True)
    out_chars = [c for seg in res["segments"] for c in seg.get("chars", [])]
    times = [None] * len(text)
    p = 0
    for c in out_chars:
        ch = c.get("char", "")
        if not ch.strip():
            continue
        q = p
        while q < len(text) and q < p + 8 and text[q] != ch:
            q += 1
        if q < len(text) and text[q] == ch:
            if "start" in c:
                times[q] = (c["start"], c["end"])
            p = q + 1
    return times


def fill(times, lo, hi):
    """没对上的字（英文、数字、标点）用前后插值补齐"""
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i]:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        a = times[prev][1] if prev is not None else lo
        b = times[nxt][0] if nxt is not None else hi
        l0 = prev if prev is not None else -1
        h0 = nxt if nxt is not None else len(times)
        t = a + (b - a) * (i - l0) / (h0 - l0)
        times[i] = (t, t)
    return times


def align_chunk(lines, audio16, dur, model, meta):
    """滑动窗口逐句对齐，返回每句的逐字时间列表"""
    result = [None] * len(lines)
    i, t0 = 0, 0.0
    while i < len(lines):
        j, n = i, 0
        while j < len(lines) and (j == i or n + len(lines[j]) <= WINDOW_CHARS):
            n += len(lines[j])
            j += 1
        last = j >= len(lines)
        t1 = dur if last else min(dur, t0 + n / RATE * 1.5 + 4)
        text = "".join(lines[i:j])
        times = fill(char_times(text, t0, t1, audio16, model, meta), t0, t1)
        keep = j if (last or j - i == 1) else j - 1  # 窗口最后一句留给下个窗口
        off = 0
        for k in range(i, j):
            seg = times[off:off + len(lines[k])]
            off += len(lines[k])
            if k < keep:
                result[k] = seg
        t0 = result[keep - 1][-1][1]
        i = keep
    return result


def quiet_cut(samples, a, b):
    """在 [a, b] 秒之间找最安静的点（80ms 窗口 RMS 最小处，避免把字内部的短暂停顿当成句间停顿）。
    对齐给出的字边界常有 0.1 秒级误差，取中点会切进下一句第一个字的起音（听起来像「卡字」）。"""
    a, b = max(0.0, a), min(len(samples) / SR, b)
    if b - a < 0.05:
        return (a + b) / 2
    x = samples[int(a * SR):int(b * SR)].astype(np.float32)
    win, hop = int(0.08 * SR), int(0.005 * SR)
    rms = [np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(0, max(1, len(x) - win), hop)]
    return a + (int(np.argmin(rms)) * hop + win / 2) / SR


def fade(seg, ms=10):
    n = min(len(seg) // 2, int(SR * ms / 1000))
    seg = seg.astype(np.float32)
    seg[:n] *= np.linspace(0, 1, n)
    seg[-n:] *= np.linspace(1, 0, n)
    return seg.astype(np.int16)


def main():
    story = json.loads((ROOT / "script" / "storyboard.json").read_text())
    by = {s["id"]: s for s in story["scenes"]}
    chunks = json.loads((AUDIO / "chunks.json").read_text())
    model, meta = whisperx.load_align_model(language_code="zh", device="cpu")
    scenes_out = []
    for ci, ch in enumerate(chunks):
        samples = read_wav(AUDIO / ch["audio"])
        dur = len(samples) / SR
        audio16 = resample_poly(samples.astype(np.float32) / 32768, 2, 3).astype(np.float32)
        flat = [(sid, who, text) for sid in ch["scenes"] for who, text in by[sid]["lines"]]
        per_line = align_chunk([t for _, _, t in flat], audio16, dur, model, meta)
        # 每个镜头的首句开始 / 末句结束
        spans = {}
        for (sid, who, text), times in zip(flat, per_line):
            sp = spans.setdefault(sid, {"lines": []})
            sp["lines"].append((who, text, times))
        ids = ch["scenes"]
        # 相邻镜头之间的切点：从上一句末字开始前 0.3s 到下一句首字开始后 0.35s，取最安静的地方
        # （对齐的字边界常偏晚 0.2–0.5s，窗口要放宽才能覆盖真正的停顿）
        cuts = [quiet_cut(samples, spans[ids[k]]["lines"][-1][2][-1][0] - 0.3, spans[ids[k + 1]]["lines"][0][2][0][0] + 0.35)
                for k in range(len(ids) - 1)]
        for k, sid in enumerate(ids):
            ls = spans[sid]["lines"]
            first, lastl = ls[0][2][0][0], ls[-1][2][-1][1]
            cut0 = 0.0 if k == 0 else cuts[k - 1]
            if k == len(ids) - 1:
                cut1 = dur + (END_TAIL if ci == len(chunks) - 1 else 0)
            else:
                cut1 = cuts[k]
            seg = fade(samples[int(cut0 * SR):int(min(cut1, dur) * SR)])
            if cut1 > dur:
                seg = np.concatenate([seg, np.zeros(int((cut1 - dur) * SR), np.int16)])
            write_wav(AUDIO / f"{sid}.wav", seg)
            out_lines = [{"who": w, "text": t, "start": round(tm[0][0] - cut0, 3), "end": round(tm[-1][1] - cut0, 3),
                          "chars": [round(x[0] - cut0, 3) for x in tm]} for w, t, tm in ls]
            scenes_out.append({"id": sid, "title": by[sid]["title"], "audio": f"audio/{sid}.wav",
                               "duration": round(len(seg) / SR, 3), "lines": out_lines})
        print(f"[组{ch['chunk']:02d}] {dur:.1f}s → {len(ids)} 个镜头")
    (ROOT / "build").mkdir(exist_ok=True)
    (ROOT / "build" / "timeline.json").write_text(json.dumps({"scenes": scenes_out}, ensure_ascii=False))
    total = sum(s["duration"] for s in scenes_out)
    chars = sum(len(l["text"]) for s in scenes_out for l in s["lines"])
    print(f"写入 build/timeline.json：{len(scenes_out)} 个镜头，总时长 {total:.1f} 秒（{total / 60:.1f} 分钟），语速 {chars / total:.2f} 字/秒")


if __name__ == "__main__":
    main()
