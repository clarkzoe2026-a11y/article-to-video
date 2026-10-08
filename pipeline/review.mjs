// 逐帧审核：在每个画面“停稳”的时刻抽一帧，拼成 3x3 缩略图墙，并输出对照表（帧号 ↔ 口播）
import fs from 'fs';
import {execFileSync} from 'child_process';
const FPS = 30, MOVE = 0.7, OVERVIEW = 1.1;
// 用法：node pipeline/review.mjs <文章目录>   （读 out/video.mp4，输出 out/review/）
const dir = process.argv[2];
const props = JSON.parse(fs.readFileSync(`${dir}/build/props.json`, 'utf8'));
const tl = props.timeline, SHOTS = props.shots;
const out = `${dir}/out/review`; fs.rmSync(out, {recursive: true, force: true}); fs.mkdirSync(out, {recursive: true});
const rows = []; let base = 0;
const say = (sc, t) => { const l = [...sc.lines].reverse().find((x) => t >= x.start); if (!l) return ''; let i = l.chars.findIndex((c) => c > t); if (i < 0) i = l.text.length; return l.text.slice(Math.max(0, i - 10), i + 8); };
for (const sc of tl.scenes) {
  const shots = SHOTS[sc.id] || []; const cur = {};
  const raw = shots.map((s) => { const l = sc.lines[s.at.line]; let idx = 0; if (s.at.kw) { idx = l.text.indexOf(s.at.kw, cur[s.at.line] || 0); cur[s.at.line] = idx + 1; } return s.at.kw ? l.chars[idx] : l.start; });
  const ts = raw.map((t, i) => { if (i === 0) return 0; const s = shots[i], p = shots[i - 1]; return (!p || p.img === s.img || s.mode !== 'zoom') ? t : Math.max(raw[i - 1] + 1, t - 0.8); });
  shots.forEach((s, i) => {
    const overview = i > 0 ? shots[i - 1].img !== s.img && s.mode === 'zoom' : s.mode === 'zoom';
    const marks = overview ? [['全图', ts[i] + 0.9], ['推近', ts[i] + OVERVIEW + MOVE + 0.3]] : [['停稳', ts[i] + MOVE + 0.3]];
    for (const [tag, t] of marks) { const tt = Math.min(t, (ts[i + 1] ?? sc.duration) - 0.05); rows.push({n: rows.length + 1, scene: sc.id, img: s.img || (s.code ? 'code' : s.status ? 'stat' : s.browser ? 'brow' : 'card'), mode: s.mode || '', kw: s.at.kw || `第${s.at.line}句开头`, tag, abs: base + tt, say: say(sc, tt)}); }
  });
  if (!shots.length) rows.push({n: rows.length + 1, scene: sc.id, img: '-', mode: '', kw: '', tag: '中段', abs: base + sc.duration * 0.7, say: say(sc, sc.duration * 0.7)});
  base += Math.round(sc.duration * FPS) / FPS;
}
for (const r of rows) execFileSync('npx', ['remotion', 'ffmpeg', '-loglevel', 'error', '-ss', r.abs.toFixed(2), '-i', `${dir}/out/video.mp4`, '-frames:v', '1', '-vf', 'scale=640:-1', `${out}/f${String(r.n).padStart(3, '0')}.jpg`]);
fs.writeFileSync(`${out}/index.txt`, rows.map((r) => `#${r.n} ${r.abs.toFixed(1)}s ${r.scene} [${r.img} ${r.mode} ${r.tag}] 关键词「${r.kw}」 口播：…${r.say}…`).join('\n'));
execFileSync(process.env.A2V_PYTHON || new URL('../.venv/bin/python', import.meta.url).pathname, [new URL('./sheets.py', import.meta.url).pathname, out]);
console.log(rows.length, '帧，', fs.readdirSync(out).filter((f) => f.startsWith('sheet')).length, '张缩略图墙');
