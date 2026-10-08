"""把某个角色的全部台词按顺序拼成一个试听文件（句间 0.6 秒静音），给用户快速确认声音有没有串（关卡 2b）。
用法：python pipeline/role_review.py <文章目录> [B]   → out/voice_<角色>_review.wav
"""
import json
import pathlib
import sys
import wave

import numpy as np

ROOT = pathlib.Path(sys.argv[1]).resolve()
ROLE = sys.argv[2] if len(sys.argv) > 2 else "B"
SR = 24000
gap = np.zeros(int(0.6 * SR), np.int16)
parts, n = [], 0
for s in json.loads((ROOT / "build" / "timeline.json").read_text())["scenes"]:
    with wave.open(str(ROOT / "public" / "audio" / f"{s['id']}.wav")) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16)
    for l in s["lines"]:
        if l["who"] == ROLE:
            parts += [x[int(max(0, l["start"] - 0.05) * SR):int((l["end"] + 0.15) * SR)], gap]
            n += 1
out = ROOT / "out" / f"voice_{ROLE}_review.wav"
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.concatenate(parts).tobytes())
print(f"{ROLE} 角色 {n} 句，{sum(len(p) for p in parts) / SR:.0f} 秒 → {out}")
