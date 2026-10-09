"""逐句核对配音的说话人：画面上不显示「主讲/提问」，但每句台词在 storyboard 里都标了角色（A/B），
这里用音高（基频）检查实际声音是否对得上：A=Callirrhoe（女声，音高高），B=Puck（男声，音高低）。

多人对话 TTS 在长音频里偶尔会把某句念成另一个人的声音；只靠耳朵很难发现，这一步自动找出来。
输出 build/voicecheck.json，并列出可疑的句子。用法：python pipeline/voicecheck.py <文章目录>
"""
import json
import pathlib
import sys
import wave

import numpy as np
import torch
import torchaudio

MFCC = torchaudio.transforms.MFCC(sample_rate=24000, n_mfcc=20, melkwargs={"n_fft": 1024, "hop_length": 256, "n_mels": 40})

ROOT = pathlib.Path(sys.argv[1]).resolve()
AUDIO = ROOT / "public" / "audio"
SR = 24000
FRAME, HOP = 1024, 512
FMIN, FMAX = 70, 400


def read(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def f0_track(x):
    """简单的自相关基频估计：返回每个有声帧的基频（Hz）"""
    out = []
    lo, hi = SR // FMAX, SR // FMIN
    win = np.hanning(FRAME)
    rms_gate = 0.02
    for i in range(0, len(x) - FRAME, HOP):
        fr = x[i:i + FRAME]
        if np.sqrt(np.mean(fr ** 2)) < rms_gate:
            continue
        fr = (fr - fr.mean()) * win
        spec = np.fft.rfft(fr, 2 * FRAME)
        ac = np.fft.irfft(spec * np.conj(spec))[:FRAME]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.45:  # 周期性足够强才算有声
            out.append(SR / lag)
    return np.array(out)


def main():
    scenes = json.loads((ROOT / "build" / "timeline.json").read_text())["scenes"]
    rows = []
    for s in scenes:
        x = read(AUDIO / f"{s['id']}.wav")
        for i, l in enumerate(s["lines"]):
            seg = x[int(l["start"] * SR):min(len(x), int(l["end"] * SR))]
            if len(seg) < int(0.15 * SR):  # 对齐偏差让这句几乎落在镜头音频之外：跳过，不影响其他句子
                print(f"⚠ {s['id']} 第{i}句对齐过短，跳过音色核对：{l['text']}")
                continue
            f = f0_track(seg)
            rows.append({"scene": s["id"], "line": i, "who": l["who"], "text": l["text"],
                         "f0": round(float(np.median(f)), 1) if len(f) >= 5 else None, "voiced": int(len(f))})
    if len({r["who"] for r in rows}) < 2:
        print("只有一个角色（单人旁白），无需核对串声")
        sys.exit(0)
    # 音色特征：每句的 MFCC 均值/标准差 + 对数音高；标准化后做“留一法最近类中心”判断
    feats = []
    for s in scenes:
        x = read(AUDIO / f"{s['id']}.wav")
        for l in s["lines"]:
            if not any(r["scene"] == s["id"] and r["text"] == l["text"] for r in rows):
                continue
            seg = torch.from_numpy(x[int(l["start"] * SR):min(len(x), int(l["end"] * SR))].copy())
            m = MFCC(seg.unsqueeze(0))[0].numpy()
            feats.append(np.concatenate([m.mean(1), m.std(1)]))
    X = np.array(feats)
    f0 = np.array([np.log(r["f0"]) if r["f0"] else np.nan for r in rows])
    f0[np.isnan(f0)] = np.nanmedian(f0)
    X = np.column_stack([X, f0 * 3])  # 音高给一点额外权重
    X = (X - X.mean(0)) / (X.std(0) + 1e-6)
    who = np.array([r["who"] for r in rows])
    sus = []
    for i, r in enumerate(rows):
        mask = np.arange(len(rows)) != i
        ca = X[mask & (who == "A")].mean(0)
        cb = X[mask & (who == "B")].mean(0)
        da, db = np.linalg.norm(X[i] - ca), np.linalg.norm(X[i] - cb)
        r["detected"] = "A" if da < db else "B"
        r["margin"] = round(float(abs(da - db) / (da + db)), 3)  # 越大越确定
        if r["detected"] != r["who"]:
            sus.append(r)
    a = [r["f0"] for r in rows if r["who"] == "A" and r["f0"]]
    b = [r["f0"] for r in rows if r["who"] == "B" and r["f0"]]
    ma, mb, cut = float(np.median(a)), float(np.median(b)), 0.0
    sus.sort(key=lambda r: -r["margin"])
    (ROOT / "build" / "voicecheck.json").write_text(json.dumps(
        {"median_A": ma, "median_B": mb, "cut": cut, "lines": rows}, ensure_ascii=False, indent=1))
    print(f"主讲 A 音高中位数 {ma:.0f}Hz，提问 B {mb:.0f}Hz；共 {len(rows)} 句（按音色+音高留一法判断）")
    if not sus:
        print("✓ 所有句子的声音都与标注的角色一致")
    for r in sus:
        print(f"✗ {r['scene']} 第{r['line']}句 标注={r['who']} 实测像={r['detected']} 把握度={r['margin']}（{r['f0']}Hz）：{r['text'][:28]}")
    sys.exit(1 if sus else 0)


if __name__ == "__main__":
    main()
