"""扫描全片，找出画面区突然变黑的单帧（与前后帧相比亮度骤降）"""
import glob, os, shutil, subprocess, sys
import numpy as np
from PIL import Image
src = sys.argv[1]; tmp = os.path.join(os.path.dirname(os.path.abspath(src)), '_bf')
shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
subprocess.run(['npx', 'remotion', 'ffmpeg', '-loglevel', 'error', '-i', src, '-vf', 'scale=96:54', f'{tmp}/%05d.jpg'], check=True)
m = np.array([np.asarray(Image.open(p).convert('L'), float)[5:43, 8:88].mean() for p in sorted(glob.glob(f'{tmp}/*.jpg'))])
bad = [i for i in range(1, len(m) - 1) if m[i] < m[i - 1] - 15 and m[i] < m[i + 1] - 15]
print(f'{len(m)} 帧，单帧黑屏 {len(bad)} 处：', ', '.join(f'{i / 30:.2f}s' for i in bad[:40]))
shutil.rmtree(tmp)
sys.exit(1 if bad else 0)
