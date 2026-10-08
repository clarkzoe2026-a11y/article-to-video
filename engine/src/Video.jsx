import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, Easing,
  staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
// 每篇文章的数据都通过 --props 传入（由 pipeline/bundle.py 生成 build/props.json）：
// timeline（逐字时间轴）、images（图片尺寸）、shots（画面安排）、steps（右上角步骤条）、meta（片尾卡片）
let timeline = {scenes: []}, IMAGES = {}, SHOTS = {}, STEP_OF_SCENE = {}, STEP_NAMES = [], META = {};
export const useProps = (p) => {
  timeline = p.timeline; IMAGES = p.images; SHOTS = p.shots;
  STEP_OF_SCENE = p.steps?.ofScene || {}; STEP_NAMES = p.steps?.names || []; META = p.meta || {};
};

export const FPS = 30;
// 视觉风格：黑 / 白 / 灰 + 唯一亮色 ACCENT_PRIMARY = #DDFB78（见 docs/STYLE.md）
const C = {
  bg: '#0D0D0D', panel: '#1A1A1A', ink: '#F2F2F0', sub: '#8E8E8E', muted: '#5A5A5A', dark: '#0D0D0D',
  orange: '#DDFB78', orangeSoft: 'rgba(221,251,120,.14)', line: '#3A3A3A',
};
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const SERIF = '"Songti SC", "STSong", serif';
const STAGE = {x: 80, y: 120, w: 1760, h: 740};
const MOVE = 0.7; // 镜头移动时长（秒）
const OVERVIEW = 1.1; // 新截图先展示全图的时长（秒）

export const totalFrames = (p) =>
  Math.max(1, p.timeline.scenes.reduce((n, s) => n + Math.round(s.duration * FPS), 0));

// ---------- 时间工具 ----------
const kwTime = (scene, at, from = 0) => {
  const line = scene.lines[at.line];
  if (!at.kw) return {t: line.start, idx: 0};
  const idx = line.text.indexOf(at.kw, from);
  if (idx < 0) return {t: line.start, idx: 0};
  return {t: line.chars[idx], idx: idx + 1};
};
const shotTimes = (scene, shots) => {
  const cursor = {};
  const raw = shots.map((s) => {
    const r = kwTime(scene, s.at, cursor[s.at.line] || 0);
    cursor[s.at.line] = r.idx;
    return r.t;
  });
  // 新截图要先展示全图，提前一点开始，但不早于上一个画面后 1 秒
  return raw.map((t, i) => {
    if (i === 0) return 0; // 第一个画面从镜头开头就显示，避免镜头交界处空屏
    const s = shots[i];
    const prev = shots[i - 1];
    if (!prev || prev.img === s.img || s.mode !== 'zoom') return t;
    return Math.max(raw[i - 1] + 1.0, t - 0.8);
  });
};
const ease = (x) => Easing.bezier(0.45, 0, 0.2, 1)(Math.min(1, Math.max(0, x)));

// ---------- 镜头相机 ----------
const fitScale = ([iw, ih]) => Math.min(STAGE.w / iw, STAGE.h / ih);
const camFor = (shot) => {
  const [iw, ih] = IMAGES[shot.img];
  const s0 = fitScale([iw, ih]);
  if (shot.mode !== 'zoom') return {s: s0, cx: iw / 2, cy: ih / 2};
  const [rx, ry, rw, rh] = shot.rect;
  const s = Math.max(s0, Math.min(STAGE.w / (rw * iw * 1.25), STAGE.h / (rh * ih * 1.35), s0 * 2.4));
  return {s, cx: (rx + rw / 2) * iw, cy: (ry + rh / 2) * ih};
};
const lerpCam = (a, b, k) => ({
  s: Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k),
  cx: a.cx + (b.cx - a.cx) * k,
  cy: a.cy + (b.cy - a.cy) * k,
});
const toStage = (cam, x, y) => ({x: STAGE.w / 2 + (x - cam.cx) * cam.s, y: STAGE.h / 2 + (y - cam.cy) * cam.s});

const Cursor = ({x, y, press}) => (
  <div style={{position: 'absolute', left: x, top: y, pointerEvents: 'none'}}>
    <div style={{
      position: 'absolute', left: -28, top: -28, width: 56, height: 56, borderRadius: 28,
      border: `4px solid ${C.orange}`, opacity: press > 0 ? 1 - press : 0, transform: `scale(${0.4 + press * 1.4})`,
    }} />
    {/* 光标：黑色填充 + 白色描边 + 投影，深色/白色背景上都清楚（不要用 C.ink，深色主题下它是浅色） */}
    <svg width="42" height="50" viewBox="0 0 19 23" style={{position: 'absolute', left: -4, top: -2, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))'}}>
      <path d="M1 1 L1 18 L5.5 13.8 L8.6 21 L11.6 19.7 L8.6 12.6 L14.6 12.6 Z" fill="#0D0D0D" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  </div>
);

// 聚光遮罩：在图片范围内，用 4 块矩形把 rect 以外压暗
const SpotMask = ({img, cam, rect, alpha}) => {
  if (!(alpha > 0)) return null;
  const [iw, ih] = IMAGES[img];
  const pad = 10;
  const o = toStage(cam, 0, 0);
  const a = toStage(cam, rect[0] * iw, rect[1] * ih);
  const b = toStage(cam, (rect[0] + rect[2]) * iw, (rect[1] + rect[3]) * ih);
  const ox0 = a.x - pad - o.x, oy0 = a.y - pad - o.y, ox1 = b.x + pad - o.x, oy1 = b.y + pad - o.y;
  const IW = iw * cam.s, IH = ih * cam.s, dim = `rgba(10,9,7,${0.62 * alpha})`;
  const piece = (l, tp, w, h) => <div style={{position: 'absolute', left: l, top: tp, width: Math.max(0, w), height: Math.max(0, h), background: dim}} />;
  return (
    <div style={{position: 'absolute', left: o.x, top: o.y, width: IW, height: IH, overflow: 'hidden', borderRadius: 14}}>
      {piece(0, 0, IW, oy0)}{piece(0, oy1, IW, IH - oy1)}{piece(0, oy0, ox0, oy1 - oy0)}{piece(ox1, oy0, IW - ox1, oy1 - oy0)}
    </div>
  );
};

const ImageStage = ({scene, shots, times, t}) => {
  // 当前与上一个画面
  let k = 0;
  for (let i = 0; i < shots.length; i++) if (t >= times[i]) k = i;
  const shot = shots[k];
  const prev = k > 0 ? shots[k - 1] : null;
  const p = ease((t - times[k]) / MOVE);
  const sameImg = prev && prev.img === shot.img;
  const target = camFor(shot);
  // 新图片 + 推近：先看全图（框出位置），停 OVERVIEW 秒再推近
  const overview = !sameImg && shot.mode === 'zoom';
  const lead = overview ? OVERVIEW : 0;
  const full = camFor({img: shot.img, mode: 'full'});
  const cam = sameImg
    ? lerpCam(camFor(prev), target, p)
    : overview ? lerpCam(full, target, ease((t - times[k] - OVERVIEW) / MOVE)) : target;
  const [iw, ih] = IMAGES[shot.img];
  // 换图：新图在上层匀速淡入，旧图在下层保持，等新图基本盖住后再淡出（避免中途透出黑底）
  const lin = Math.min(1, Math.max(0, (t - times[k]) / MOVE));
  const fadeIn = sameImg || !prev ? 1 : Math.min(1, lin * 1.25);
  const prevOut = sameImg || !prev ? 0 : 1 - Math.min(1, Math.max(0, (lin - 0.6) / 0.4));
  // 弹出：从 96% 平滑放大并淡入（不抖动）
  const popP = shot.pop ? Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (t - times[k]) / 0.4))) : 1;
  const pop = shot.pop ? 0.96 + 0.04 * popP : 1;

  const imgBox = (s, c, opacity, key) => {
    const {x, y} = toStage(c, 0, 0);
    return (
      <div key={key} style={{
        position: 'absolute', left: x, top: y, width: iw * c.s, height: ih * c.s, opacity: opacity * (key === 'cur' ? popP : 1),
        transform: `scale(${pop})`, transformOrigin: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.55)', borderRadius: 14, overflow: 'hidden', background: '#fff',
      }}>
        <Img src={staticFile(`img/${s.img}.png`)} style={{width: '100%', height: '100%', display: 'block'}} />
      </div>
    );
  };

  // 高亮框 / 聚光：同一张图上连续聚焦时，遮罩保持不变，只让高亮框平滑滑到下一处（避免整屏忽明忽暗）
  let overlay = null;
  const hasRect = (s) => s && s.rect && (s.mode === 'zoom' || s.mode === 'spot');
  const carry = sameImg && hasRect(prev); // 上一步在同一张图上已有高亮框
  const fadeOut = shot.mode === 'full' && carry; // 回到全图：高亮框和遮罩一起淡出
  if (hasRect(shot) || fadeOut) {
    const lerpRect = (r1, r2, q) => r1.map((v, i) => v + (r2[i] - v) * q);
    const show = ease((t - times[k] - (sameImg ? MOVE * 0.6 : 0.35)) / 0.35);
    const [rx, ry, rw, rh] = fadeOut ? prev.rect : carry ? lerpRect(prev.rect, shot.rect, p) : shot.rect;
    const boxAlpha = fadeOut ? 1 - p : carry ? 1 : show;
    const dimAlpha = fadeOut
      ? (prev.mode === 'spot' ? 1 - p : 0)
      : shot.mode === 'spot'
        ? (carry && prev.mode === 'spot' ? 1 : !sameImg ? fadeIn : ease((t - times[k] - 0.1) / 0.8))
        : (carry && prev.mode === 'spot' ? 1 - p : 0);
    const a = toStage(cam, rx * iw, ry * ih);
    const b = toStage(cam, (rx + rw) * iw, (ry + rh) * ih);
    const pad = 10;
    const o = toStage(cam, 0, 0);
    const spotMask = <SpotMask img={shot.img} cam={cam} rect={[rx, ry, rw, rh]} alpha={dimAlpha} />;
    overlay = (
      <>{spotMask}<div style={{
        position: 'absolute', left: a.x - pad, top: a.y - pad, width: b.x - a.x + pad * 2, height: b.y - a.y + pad * 2,
        borderRadius: 16, border: `5px solid ${C.orange}`, opacity: boxAlpha,
        boxShadow: `0 0 30px rgba(221,251,120,${0.45 * boxAlpha})`,
      }}>
        {shot.check && show > 0.5 && (
          <div style={{
            position: 'absolute', right: -30, top: -30, width: 80, height: 80, borderRadius: 40, background: C.orange,
            color: C.dark, fontSize: 52, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: `scale(${ease((show - 0.5) * 2)})`,
          }}>✓</div>
        )}
      </div></>
    );
  }

  // 光标点击
  let cursor = null;
  if (shot.click && shot.rect) {
    const [rx, ry, rw, rh] = shot.rect;
    // 默认点框的中心；shot.cursor = [x, y]（图片内 0~1 比例）可指定点到框里的某个按钮
    const [px, py] = shot.cursor || [rx + rw * 0.5, ry + rh * 0.5];
    const to = toStage(cam, px * iw, py * ih);
    const dt = t - times[k] - lead - MOVE;
    const m = ease(dt / 0.5);
    const from = {x: to.x + 260, y: to.y + 180};
    const press = dt > 0.55 ? Math.min(1, (dt - 0.55) / 0.45) : 0;
    if (dt > 0) cursor = <Cursor x={from.x + (to.x - from.x) * m} y={from.y + (to.y - from.y) * m} press={press} />;
  }

  return (
    <div style={{position: 'absolute', left: STAGE.x, top: STAGE.y, width: STAGE.w, height: STAGE.h, overflow: 'hidden'}}>
      {prevOut > 0 && imgBox(prev, camFor(prev), prevOut, 'prev')}
      {prevOut > 0 && prev.mode === 'spot' && <SpotMask img={prev.img} cam={camFor(prev)} rect={prev.rect} alpha={prevOut} />}
      {imgBox(shot, cam, fadeIn, 'cur')}
      {overlay}
      {cursor}
    </div>
  );
};

// ---------- 面板：代码 / 状态码 / 浏览器（盖在画面区上） ----------
const PANEL = {left: 200, top: 40, width: 1520, height: 700}; // 相对于顶栏下方的面板区
const Win = ({title, children}) => (
  <div style={{position: 'absolute', ...PANEL, borderRadius: 18, background: '#0D0D0D', border: `1px solid ${C.line}`, boxShadow: '0 30px 80px rgba(0,0,0,.6)', overflow: 'hidden'}}>
    <div style={{height: 50, background: C.panel, display: 'flex', alignItems: 'center', paddingLeft: 22, gap: 10}}>
      {[0, 1, 2].map((i) => <div key={i} style={{width: 14, height: 14, borderRadius: 7, background: C.line}} />)}
      <div style={{color: C.sub, fontSize: 22, marginLeft: 18, fontFamily: FONT}}>{title}</div>
    </div>
    {children}
  </div>
);

const CodePanel = ({scene, spec, t}) => {
  const tm = (a) => kwTime(scene, a).t;
  const lines = spec.lines.map((l) => ({...l, t0: tm(l.at), mk: l.mark ? tm(l.mark) : null}));
  const shown = lines.filter((l) => t >= l.t0);
  const cur = shown[shown.length - 1];
  const res = spec.result;
  const resT = res ? tm(res.at) : Infinity;
  return (
    <Win title={spec.title}>
      <div style={{padding: '30px 40px', fontFamily: 'Menlo, monospace', fontSize: lines.length > 3 ? 28 : 34, lineHeight: 1.5, color: C.ink}}>
        {shown.map((l, i) => {
          const typed = l.cmd.slice(0, Math.max(1, Math.floor((t - l.t0) * 45)));
          const active = l === cur || (l.mk && t >= l.mk);
          return (
            <div key={i} style={{marginBottom: 20, paddingLeft: 18, borderLeft: `5px solid ${active ? C.orange : 'transparent'}`, opacity: active ? 1 : 0.55}}>
              <div style={{fontFamily: FONT, fontSize: 24, color: active ? C.orange : C.sub}}># {l.note}</div>
              <div><span style={{color: C.orange}}>$</span> {typed}</div>
            </div>
          );
        })}
        {t >= resT && (
          <div style={{opacity: ease((t - resT) / 0.4), marginTop: 10, paddingLeft: 23}}>
            {res.lines.map((r, i) => <div key={i} style={{color: i === res.lines.length - 1 ? C.sub : C.ink}}>{r}</div>)}
            <div style={{marginTop: 22, color: C.orange, fontFamily: FONT, fontSize: 36}}>✓ {res.ok}</div>
          </div>
        )}
      </div>
    </Win>
  );
};

const StatusPanel = ({scene, spec, t}) => {
  const items = spec.map((x) => ({...x, t0: kwTime(scene, x.at).t}));
  const cur = [...items].reverse().find((x) => t >= x.t0);
  return (
    <div style={{position: 'absolute', ...PANEL, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, fontFamily: FONT}}>
      <div style={{color: C.sub, fontSize: 30, marginBottom: 8, paddingLeft: 260}}>常见“故障灯”（状态码）</div>
      {items.map((x) => {
        const on = x === cur;
        const seen = t >= x.t0;
        return (
          <div key={x.code} style={{display: 'flex', alignItems: 'center', gap: 40, paddingLeft: 260, opacity: seen ? (on ? 1 : 0.45) : 0.15}}>
            <div style={{width: 170, textAlign: 'center', fontFamily: 'Menlo, monospace', fontSize: 60, fontWeight: 700, color: on ? C.dark : C.ink, background: on ? C.orange : C.panel, borderRadius: 14, padding: '6px 0'}}>{x.code}</div>
            <div style={{fontSize: 44, color: on ? C.ink : C.sub}}>{x.text}</div>
          </div>
        );
      })}
    </div>
  );
};

const BrowserPanel = ({host, t0, t}) => {
  const p = ease((t - t0 - 0.6) / 0.5);
  return (
    <Win title="浏览器">
      <div style={{padding: '120px 120px', fontFamily: FONT}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 22, background: C.panel, borderRadius: 50, padding: '26px 40px', fontSize: 48, color: C.ink, border: `2px solid ${p > 0.5 ? C.orange : C.line}`}}>
          <span style={{fontSize: 46, transform: `scale(${0.6 + 0.4 * p})`, opacity: 0.3 + 0.7 * p}}>🔒</span>
          <span style={{color: p > 0.5 ? C.orange : C.sub}}>https://</span><span>{host}</span>
        </div>
        <div style={{marginTop: 60, fontSize: 40, color: C.orange, opacity: p}}>✓ 地址栏变成 https，带上小锁 —— 锁装好了</div>
      </div>
    </Win>
  );
};

// ---------- 宣传片用的面板：视频片段 / 大数字 / 流程图 / 长图滚动 ----------
// 视频片段：把成片的一段剪进来（静音播放，声音用本片口播），src 放在文章 public/ 下
const ClipPanel = ({spec, t0, t}) => (
  <div style={{position: 'absolute', left: STAGE.x, top: 10, width: STAGE.w, height: STAGE.h, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
    <div style={{position: 'relative', height: STAGE.h, aspectRatio: spec.keepSubs ? '16 / 9' : '16 / 7.65', borderRadius: 16, overflow: 'hidden', border: `2px solid ${C.line}`, boxShadow: '0 30px 80px rgba(0,0,0,.6)'}}>
      <Sequence from={Math.round(t0 * FPS)} layout="none">
        {/* 裁掉片段自己的底部字幕区（约 15%），避免和本片字幕叠在一起 */}
        <OffthreadVideo src={staticFile(spec.src)} startFrom={Math.round(spec.from * FPS)} muted style={{width: '100%', height: spec.keepSubs ? '100%' : '117.6%', objectFit: 'cover', objectPosition: 'top'}} />
      </Sequence>
      {spec.label && (
        <div style={{position: 'absolute', left: 24, top: 20, background: C.orange, color: C.dark, fontFamily: FONT, fontWeight: 700, fontSize: 26, padding: '6px 16px', borderRadius: 10, opacity: ease((t - t0) / 0.4)}}>{spec.label}</div>
      )}
    </div>
  </div>
);

// 大数字卡片：逐个出现，数字从 0 数上去
const StatsPanel = ({scene, spec, t}) => {
  const items = spec.map((x) => ({...x, t0: kwTime(scene, x.at).t}));
  return (
    <div style={{position: 'absolute', ...PANEL, display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 28, alignItems: 'center', fontFamily: FONT}}>
      {items.map((x) => {
        const p = ease((t - x.t0) / 0.6);
        const num = typeof x.value === 'number' ? Math.round(x.value * p) : x.value;
        return (
          <div key={x.label} style={{opacity: p, transform: `translateY(${(1 - p) * 30}px)`, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 20, padding: '50px 20px', textAlign: 'center'}}>
            <div style={{fontSize: 120, fontWeight: 800, color: C.orange, lineHeight: 1, fontFamily: 'Menlo, monospace'}}>{num}<span style={{fontSize: 44, marginLeft: 6, fontFamily: FONT}}>{x.unit}</span></div>
            <div style={{fontSize: 34, color: C.ink, marginTop: 24}}>{x.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// 流程图：步骤横排，讲到哪步亮哪步；gate=true 的步骤挂「你来确认」徽章
const FlowPanel = ({scene, spec, t}) => {
  const steps = spec.map((x) => ({...x, t0: kwTime(scene, x.at).t}));
  const cur = [...steps].reverse().find((x) => t >= x.t0);
  return (
    <div style={{position: 'absolute', ...PANEL, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: FONT}}>
      {steps.map((x, i) => {
        const seen = t >= x.t0, on = x === cur, p = ease((t - x.t0) / 0.4);
        return (
          <React.Fragment key={x.name}>
            {i > 0 && <div style={{color: seen ? C.orange : C.line, fontSize: 44, opacity: seen ? 1 : 0.5}}>→</div>}
            <div style={{position: 'relative', width: 230, height: 200, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: on ? C.orange : C.panel, border: `2px solid ${seen ? C.orange : C.line}`, opacity: seen ? 1 : 0.35, transform: `scale(${on ? 1 + 0.05 * p : 1})`}}>
              <div style={{fontSize: 30, color: on ? C.dark : C.sub, fontFamily: 'Menlo, monospace'}}>{i + 1}</div>
              <div style={{fontSize: 36, fontWeight: 700, color: on ? C.dark : C.ink, marginTop: 10}}>{x.name}</div>
              {x.gate && seen && (
                <div style={{position: 'absolute', bottom: -58, whiteSpace: 'nowrap', fontSize: 24, color: C.orange, border: `1.5px solid ${C.orange}`, borderRadius: 999, padding: '4px 14px', opacity: p}}>✋ 你来确认</div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// 长图滚动：几张图竖向排成一列，匀速向上滚（表现「很长的图文文章」）
const ScrollPanel = ({spec, t0, t, dur}) => {
  const W = 900;
  const hs = spec.imgs.map((n) => (IMAGES[n][1] / IMAGES[n][0]) * W);
  const total = hs.reduce((a, b) => a + b + 24, 0);
  const y = -Math.max(0, total - STAGE.h) * Math.min(1, Math.max(0, (t - t0) / dur));
  return (
    <div style={{position: 'absolute', left: (1920 - W) / 2, top: 10, width: W, height: STAGE.h, overflow: 'hidden', borderRadius: 16}}>
      <div style={{transform: `translateY(${y}px)`}}>
        {spec.imgs.map((n) => <Img key={n} src={staticFile(`img/${n}.png`)} style={{width: W, display: 'block', marginBottom: 24, borderRadius: 12}} />)}
      </div>
    </div>
  );
};

// ---------- 片尾卡片 ----------
const OutroCard = ({p}) => (
  <AbsoluteFill style={{background: C.bg, opacity: p, alignItems: 'center', justifyContent: 'center'}}>
    <div style={{display: 'flex', gap: 70, alignItems: 'center', transform: `translateY(${(1 - p) * 30}px)`}}>
      <Img src={staticFile(`img/${META.cover}.png`)} style={{width: 820, borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,.5)'}} />
      <div style={{width: 640, fontFamily: FONT}}>
        <div style={{color: C.orange, fontSize: 30, fontWeight: 700, letterSpacing: 2}}>{META.kicker || '完整图文教程'}</div>
        <div style={{color: C.ink, fontSize: 52, fontWeight: 800, lineHeight: 1.35, marginTop: 16, fontFamily: SERIF}}>{META.title}</div>
        <div style={{color: C.sub, fontSize: 30, marginTop: 28}}>{META.subtitle}</div>
        {META.link && <div style={{color: C.orange, fontSize: 24, marginTop: 14, fontFamily: 'Menlo, monospace', whiteSpace: 'nowrap'}}>{META.link}</div>}
        <div style={{display: 'flex', alignItems: 'center', gap: 28, marginTop: 44}}>
          {META.qr && (
            <div style={{width: 200, height: 200, borderRadius: 16, background: '#fff', padding: 10, boxSizing: 'border-box'}}>
              <Img src={staticFile(META.qr)} style={{width: '100%', height: '100%', display: 'block'}} />
            </div>
          )}
          <div style={{fontSize: 30, color: C.sub, lineHeight: 1.6}}>微信扫码或搜索公众号<br /><b style={{color: C.orange, fontSize: 44, fontFamily: SERIF}}>{META.account}</b></div>
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

// ---------- 字幕 ----------
// 口播是“念法”，字幕显示“写法”
const DISPLAY = [
  ['四七点九八点几点几', '47.98.xx.xx'], ['四七点九八', '47.98'], ['bookdot 点 cn', 'bookdot.cn'],
  ['艾特符号', '@ 符号'], ['二十四小时', ' 24 小时'], ['九十天', ' 90 天 '],
  ['六十到一百', ' 60~100 元'], ['一年几百', '一年几百元'],
  ['一二七点零点零点一', ' 127.0.0.1 '], ['冒号五千', ':5000'], ['五千号', ' 5000 号'], ['五千', ' 5000 '],
  ['二百 OK', ' 200 OK'], ['四零四', '404'], ['五零二', '502'], ['五零零', '500'], ['发送域名填 host', '发送域名填 $host'],
];
const PHRASE_MAX = 18;
const isPunct = (c) => '，。？！：；、…—'.includes(c);
const phrases = (line) => {
  // 先按标点切成小段，再把相邻小段拼到不超过 PHRASE_MAX 字（中间用空格）
  const text = line.text;
  const parts = [];
  let a = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || isPunct(text[i])) {
      if (i > a) parts.push({a, b: i, end: text[i] || ''});
      a = i + 1;
    }
  }
  const groups = [];
  for (const p of parts) {
    const g = groups[groups.length - 1];
    const len = (x) => x.b - x.a;
    if (g && g.items.reduce((n, x) => n + len(x) + 1, 0) + len(p) <= PHRASE_MAX && !'？！'.includes(g.items[g.items.length - 1].end)) g.items.push(p);
    else groups.push({items: [p]});
  }
  return groups.map(({items}) => {
    let str = items.map((x) => text.slice(x.a, x.b) + ('？！'.includes(x.end) ? x.end : '')).join(' ');
    for (const [from, to] of DISPLAY) str = str.split(from).join(to);
    return {text: str.replace(/\s+/g, ' ').trim(), t: line.chars[items[0].a]};
  });
};

const Subtitle = ({scene, t}) => {
  const line = [...scene.lines].reverse().find((l) => t >= l.start - 0.05);
  if (!line || t > line.end + 0.8) return null;
  const ps = phrases(line);
  const cur = [...ps].reverse().find((p) => t >= p.t - 0.05) || ps[0];
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 52, display: 'flex', justifyContent: 'center'}}>
      <div style={{background: 'rgba(8,9,12,.72)', padding: '16px 38px', borderRadius: 16, fontFamily: FONT}}>
        <div style={{fontSize: 48, color: '#FFFFFF', fontWeight: 500, letterSpacing: 1}}>{cur.text}</div>
      </div>
    </div>
  );
};

// ---------- 顶栏 ----------
const Header = ({scene}) => {
  const step = STEP_OF_SCENE[scene.id];
  return (
    <div style={{position: 'absolute', left: 80, right: 80, top: 36, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: FONT}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
        <div style={{width: 8, height: 34, background: C.orange, borderRadius: 4}} />
        <div style={{fontSize: 34, fontWeight: 700, color: C.ink, fontFamily: SERIF}}>{scene.title}</div>
      </div>
      {step && (
        <div style={{display: 'flex', gap: 8}}>
          {STEP_NAMES.map((n, i) => (
            <div key={n} style={{
              fontSize: 18, padding: '6px 10px', borderRadius: 8,
              background: i + 1 === step ? C.orange : i + 1 < step ? C.orangeSoft : 'transparent',
              color: i + 1 === step ? C.dark : i + 1 < step ? C.orange : C.muted,
              border: `1.5px solid ${i + 1 <= step ? C.orange : C.line}`, fontWeight: i + 1 === step ? 700 : 500,
            }}>{i + 1}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- 单个镜头 ----------
const isPanel = (s) => s.code || s.status || s.browser || s.card || s.clip || s.stats || s.flow || s.scroll;
const Scene = ({scene}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const shots = SHOTS[scene.id] || [];
  const times = shotTimes(scene, shots);
  const imageShots = shots.filter((s) => !isPanel(s));
  const imageTimes = times.filter((_, i) => !isPanel(shots[i]));
  // 当前生效的面板（直到下一个画面出现为止）
  let k = -1;
  for (let i = 0; i < shots.length; i++) if (t >= times[i]) k = i;
  const panel = k >= 0 && isPanel(shots[k]) ? shots[k] : null;
  const panelP = panel ? ease((t - times[k]) / 0.35) : 0;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Audio src={staticFile(scene.audio)} />
      <Header scene={scene} />
      {imageShots.length > 0 && t >= imageTimes[0] && <ImageStage scene={scene} shots={imageShots} times={imageTimes} t={t} />}
      {panel && !panel.card && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 110, bottom: 0, background: C.bg, opacity: panelP}}>
          {panel.code && <CodePanel scene={scene} spec={panel.code} t={t} />}
          {panel.status && <StatusPanel scene={scene} spec={panel.status} t={t} />}
          {panel.browser && <BrowserPanel host={panel.browser} t0={times[k]} t={t} />}
          {panel.clip && <ClipPanel spec={panel.clip} t0={times[k]} t={t} />}
          {panel.stats && <StatsPanel scene={scene} spec={panel.stats} t={t} />}
          {panel.flow && <FlowPanel scene={scene} spec={panel.flow} t={t} />}
          {panel.scroll && <ScrollPanel spec={panel.scroll} t0={times[k]} t={t} dur={(k + 1 < shots.length ? times[k + 1] : scene.duration) - times[k]} />}
        </div>
      )}
      {panel && panel.card && <OutroCard p={panelP} />}
      <Subtitle scene={scene} t={t} />
    </AbsoluteFill>
  );
};

export const Video = (props) => {
  useProps(props);
  let from = 0;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {timeline.scenes.map((s) => {
        const dur = Math.round(s.duration * FPS);
        const seq = <Sequence key={s.id} from={from} durationInFrames={dur}><Scene scene={s} /></Sequence>;
        from += dur;
        return seq;
      })}
    </AbsoluteFill>
  );
};
