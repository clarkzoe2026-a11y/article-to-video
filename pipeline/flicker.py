"""测量一段视频的逐帧平均亮度，报告帧间最大跳变（检测忽明忽暗）"""
import glob, os, shutil, subprocess, sys
import numpy as np
from PIL import Image
src, start, dur = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
fps, tmp = 15, os.path.join(os.path.dirname(os.path.abspath(src)), '_flicker')
shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
subprocess.run(['npx', 'remotion', 'ffmpeg', '-loglevel', 'error', '-i', src, '-ss', str(start), '-t', str(dur),
                '-vf', 'scale=192:108', '-r', str(fps), f'{tmp}/%04d.jpg'], check=True)
f = np.stack([np.asarray(Image.open(p).convert('L'), float) for p in sorted(glob.glob(f'{tmp}/*.jpg'))])
f = f[:, 10:85, 15:177]  # 只看画面区（去掉顶栏和字幕）
m = f.mean(axis=(1, 2)); d = np.abs(np.diff(m))
print(f'{len(m)} 帧  亮度 {m.min():.1f}~{m.max():.1f}  帧间最大跳变 {d.max():.2f}  跳变>3 的次数 {(d > 3).sum()}')
for i in np.argsort(d)[-3:][::-1]: print(f'  {start + (i + 1) / fps:.1f}s 跳变 {d[i]:.2f}')
shutil.rmtree(tmp)
