// 宣传片 v2：为宣传专门设计的动画（不走讲解视频的镜头模板），设计语言见 docs/PROMO_STYLE.md
// 两件「物」贯穿全片：手机 = 文章，显示器 = 视频；元素从手机飞进显示器 = 文章变成视频
// 节奏：音乐 Motivating Mornings 120 BPM。前段安静配钩子/痛点 → 转折处音乐骤停、敲命令 → 回车时从曲子高潮段（41.6s）重新进入
// 数据：articles/2026-10-promo-article-to-video/build/promo_props.json（build_promo.py 生成）
import React from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, Easing, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const FPS = 30;
export const PROMO_FRAMES = Math.round(87.5 * FPS);
const C = {bg: '#101316', panel: '#161616', line: '#2E2E2E', ink: '#F4F4F2', sub: '#8E8E8E', acc: '#DDFB78', dark: '#0B0B0B', body: '#1B1B1B'};
const SANS = '"PingFang SC", "Hiragino Sans GB", sans-serif';
const SERIF = '"Songti SC", "STSong", serif';
const MONO = 'Menlo, monospace';
const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => Easing.bezier(0.22, 1, 0.36, 1)(clamp(x));      // 进场：快出慢停
const easeIO = (x) => Easing.bezier(0.65, 0, 0.35, 1)(clamp(x));    // 飞、滚动
const p = (t, a, d = 0.5) => ease((t - a) / d);
const lerp = (a, b, k) => a + (b - a) * k;
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// —— 时间表（秒）——
const T = {
  // v3 旁白（68.9 秒，10 段）：每段旁白开口的时间
  vo: {v1_hook: 0.6, v2_pain: 3.7, v3_turn: 14.85, v4_hero: 18.25, v5a_steps: 35.0, v5b_gates: 57.4, v6_proof: 64.6, v6b_tag: 69.9, v7_cta: 72.6, v8_making: 77.6},
  pain: 3.5, turn: 14.5, enter: 17.5, drop: 17.75, dialog: 27.6, dialogEnd: 34.7, control: 34.7, proof: 64.4, cta: 69.6, logo: 72.5, making: 77.3, final: 84.2, end: 87.5,
};
// 成片片段：demo_dns = 第一支成片 6544–9794 帧（DNS 讲解 + 设置步骤，原声）；demo_cmd = 9795–10244 帧（nslookup 验证，静音）
// demo_push = 4950–5250 帧（第 1 步推送代码：「我还没有 GitHub 账号呢」→ 红框 + 光标点「去连接」，原声）
const CLIP = {dns: {src: 'video/demo_dns.mp4', film: 6544 / 30}, cmd: {src: 'video/demo_cmd.mp4', film: 9795 / 30}, push: {src: 'video/demo_push.mp4', film: 4950 / 30}};
// 成片原声：提问者「我还没有 GitHub 账号呢。」→ 主讲「没关系，点了「去连接」会跳到注册页面，免费注册一个，登录就行。」
// 都是完整句子，起止点落在停顿里（按波形音量找静音，faster-whisper 转写复核）；B/A 是片段内说话的时间，用来点亮说话人
const DIALOG = {clip: 'push', from: 0.85, len: 6.95, B: [1.0, 2.6], A: [2.9, 7.65]};
const MUSIC = 'music/motivating-mornings.mp3';
const DROP_OFFSET = 41.628;                                         // 回车时从曲子高潮段接入
const STEP = [36.76, 41.04, 44.94, 48.63, 53.25];                   // 五步段（重点）：旁白念到「第 N 步」时那一步成为主角，每步约 4 秒
const ROW = 57.0;                                                   // 五步收拢成一排，随后旁白「脚本、配音、成片」点到哪一步，哪一步盖章
const CMDS = ['./a2v fetch <文章链接>', './a2v script', './a2v voice', './a2v shots', './a2v render'];
const MUSIC_LOOP = 69.85;                                           // 曲子在 72s 处放完：「让文章，被看见！」时再从高潮段接一次
const GATES = [1, 2, 4];                                            // 脚本、配音、成片三道人工关卡

// 旁白里某个关键词的绝对时间
const makeVo = (tl) => {
  const by = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
  return {at: (id, kw) => {
    const l = by[id].lines[0];
    const i = kw ? l.text.indexOf(kw) : 0;
    return T.vo[id] + (i >= 0 ? l.chars[i] : 0) - l.start;
  }};
};

// ================= 文章页（公众号排版，800 宽；块的 y 来自 build_promo.py）=================
const PAGE_W = 800;
const ArticlePage = ({art, hl}) => (
  <div style={{position: 'relative', width: PAGE_W, height: art.height + 300, background: '#fff'}}>
    <div style={{position: 'absolute', left: 40, top: 48, width: 720, fontFamily: SANS, fontSize: 40, fontWeight: 700, color: '#191919', lineHeight: 1.4}}>{art.title}</div>
    <div style={{position: 'absolute', left: 40, top: 48 + art.blocks[0].y - 76, fontFamily: SANS, fontSize: 24, color: '#576B95'}}>{art.account}</div>
    {art.blocks.map((b, i) => {
      const on = hl && hl(b);
      const base = {position: 'absolute', left: 40, top: 48 + b.y, width: 720};
      if (b.t === 'img') return <Img key={i} src={staticFile(`img/${b.id}.png`)} style={{...base, height: b.h, borderRadius: 4, outline: on ? `8px solid ${C.acc}` : 'none', outlineOffset: 6}} />;
      if (b.t === 'h') return <div key={i} style={{...base, fontFamily: SANS, fontSize: 32, fontWeight: 700, color: '#191919', lineHeight: 1.5, background: on ? C.acc : 'transparent'}}>{b.text}</div>;
      return <div key={i} style={{...base, fontFamily: SANS, fontSize: 26, color: on ? '#0B0B0B' : '#333', lineHeight: 1.75, background: on ? C.acc : 'transparent', fontWeight: on ? 700 : 400}}>{b.text}</div>;
    })}
  </div>
);

// ================= 手机 = 文章 =================
const PH = {w: 448, h: 888, bez: 14, bar: 96};
const K = (PH.w - 2 * PH.bez) / PAGE_W;                 // 文章页缩放到手机屏宽
const VIEW_H = (PH.h - 2 * PH.bez - PH.bar) / K;          // 手机屏里能看到的文章高度（文章坐标）
const Phone = ({art, scroll, hl, style}) => (
  <div style={{position: 'absolute', width: PH.w, height: PH.h, borderRadius: 66, background: C.body, boxShadow: 'inset 0 0 0 2px #3A3A3A, 0 50px 120px rgba(0,0,0,.65)', ...style}}>
    <div style={{position: 'absolute', inset: PH.bez, borderRadius: 52, overflow: 'hidden', background: '#fff'}}>
      <div style={{height: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', fontFamily: SANS, fontSize: 17, fontWeight: 600, color: '#111'}}>
        <span>9:41</span>
        <div style={{width: 110, height: 30, borderRadius: 15, background: '#000'}} />
        <div style={{width: 26, height: 12, borderRadius: 3, border: '1.5px solid #111', padding: 1.5, boxSizing: 'border-box'}}><div style={{width: '80%', height: '100%', background: '#111', borderRadius: 1}} /></div>
      </div>
      <div style={{height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', borderBottom: '1px solid #EEE', fontFamily: SANS, color: '#111'}}>
        <span style={{fontSize: 30, lineHeight: 1}}>‹</span><span style={{fontSize: 18, fontWeight: 600}}>{art.account}</span><span style={{fontSize: 22, letterSpacing: 2}}>···</span>
      </div>
      <div style={{position: 'absolute', top: PH.bar, left: 0, right: 0, bottom: 0, overflow: 'hidden'}}>
        <div style={{transform: `translateY(${-scroll * K}px) scale(${K})`, transformOrigin: 'top left'}}><ArticlePage art={art} hl={hl} /></div>
      </div>
    </div>
  </div>
);
// 文章坐标 → 画面坐标（手机在 at 处、文章滚动到 scroll）
const pageRect = (at, scroll, y, h, x = 40, w = 720) => ({x: at.x + PH.bez + x * K, y: at.y + PH.bez + PH.bar + (48 + y - scroll) * K, w: w * K, h: h * K});

// ================= 显示器 = 视频 =================
const BZ = 16, CHIN = 28;
const Monitor = ({S, stand = 1, children, style}) => (
  <div style={{position: 'absolute', inset: 0, ...style}}>
    <div style={{position: 'absolute', left: S.x + S.w / 2 - 70, top: S.y + S.h + BZ + CHIN - 2, width: 140, height: 58, opacity: stand,
      background: 'linear-gradient(#202020, #121212)', clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)'}} />
    <div style={{position: 'absolute', left: S.x + S.w / 2 - 170, top: S.y + S.h + BZ + CHIN + 54, width: 340, height: 14, borderRadius: 7, background: '#1E1E1E', boxShadow: 'inset 0 0 0 1px #333', opacity: stand}} />
    <div style={{position: 'absolute', left: S.x - BZ, top: S.y - BZ, width: S.w + 2 * BZ, height: S.h + 2 * BZ + CHIN * stand, borderRadius: 20, background: C.body, boxShadow: 'inset 0 0 0 2px #333, 0 50px 120px rgba(0,0,0,.65)'}}>
      <div style={{position: 'absolute', bottom: 9 * stand, left: '50%', width: 8, height: 8, marginLeft: -4, borderRadius: 4, background: '#3A3A3A', opacity: stand}} />
    </div>
    <div style={{position: 'absolute', left: S.x, top: S.y, width: S.w, height: S.h, overflow: 'hidden', background: '#000', borderRadius: 4}}>{children}</div>
  </div>
);
const PlayerBar = ({cur, total}) => (
  <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.8))', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px 0'}}>
    <div style={{width: 0, height: 0, borderLeft: '14px solid #fff', borderTop: '8px solid transparent', borderBottom: '8px solid transparent'}} />
    <div style={{flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.25)'}}><div style={{width: `${(cur / total) * 100}%`, height: 4, borderRadius: 2, background: C.acc}} /></div>
    <div style={{fontFamily: MONO, fontSize: 17, color: '#fff'}}>{fmt(cur)} / {fmt(total)}</div>
  </div>
);

// ================= 通用小部件 =================
const Big = ({children, style}) => <div style={{fontFamily: SANS, fontWeight: 800, color: C.ink, letterSpacing: -1, ...style}}>{children}</div>;
const Label = ({children, style}) => <div style={{position: 'absolute', fontFamily: SANS, fontSize: 26, color: C.sub, letterSpacing: 2, ...style}}>{children}</div>;
const Window = ({title, children, style}) => (
  <div style={{background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, overflow: 'hidden', position: 'relative', ...style}}>
    <div style={{height: 44, display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 18, borderBottom: `1px solid ${C.line}`}}>
      {[0, 1, 2].map((i) => <div key={i} style={{width: 12, height: 12, borderRadius: 6, background: '#3A3A3A'}} />)}
      <div style={{fontFamily: MONO, fontSize: 18, color: C.sub, marginLeft: 14}}>{title}</div>
    </div>
    {children}
  </div>
);
const Stamp = ({o}) => (
  <div style={{position: 'absolute', right: 0, top: 0, opacity: clamp(o * 3), transform: `scale(${lerp(1.7, 1, o)}) rotate(${lerp(-14, -4, o)}deg)`, zIndex: 5,
    background: C.acc, color: C.dark, fontFamily: SANS, fontWeight: 800, fontSize: 36, padding: '10px 26px', borderRadius: 999, boxShadow: '0 12px 40px rgba(221,251,120,.35)'}}>✋ 你来确认</div>
);

// ================= 字幕：旁白按短句显示 =================
const Captions = ({tl, t}) => {
  for (const s of tl.scenes) {
    const l = s.lines[0];
    const t0 = T.vo[s.id] - l.start;
    const local = t - t0;
    if (local < l.start - 0.05 || local > l.end + 0.4) continue;
    const parts = [];
    let a = 0;
    for (let i = 0; i <= l.text.length; i++) {
      if (i === l.text.length || '，。；：、'.includes(l.text[i])) { if (i > a) parts.push({a, b: i}); a = i + 1; }
    }
    const cur = [...parts].reverse().find((q) => local >= l.chars[q.a] - 0.05) || parts[0];
    return (
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center'}}>
        <div style={{fontFamily: SANS, fontSize: 38, color: '#fff', background: 'rgba(0,0,0,.55)', padding: '10px 28px', borderRadius: 12, letterSpacing: 1}}>{l.text.slice(cur.a, cur.b)}</div>
      </div>
    );
  }
  return null;
};

// ================= ① 钩子：手机里的公众号文章，缓慢滚动 =================
const Hook = ({art, t}) => {
  const out = 1 - p(t, T.pain - 0.3, 0.4);
  const rot = interpolate(t, [0, 4], [22, 10]);
  const stats = [['6,400', '字'], ['93', '张截图'], ['10', '个步骤']];
  return (
    <AbsoluteFill style={{opacity: out}}>
      <div style={{position: 'absolute', left: 300, top: 96, width: PH.w, height: PH.h, perspective: 1800}}>
        <div style={{transform: `rotateY(${rot}deg) rotateX(${rot / 4}deg) scale(${lerp(0.94, 1, p(t, 0, 1.2))})`, transformStyle: 'preserve-3d'}}>
          <Phone art={art} scroll={interpolate(t, [0, 4.3], [0, 1500], {easing: easeIO})} style={{left: 0, top: 0}} />
        </div>
      </div>
      {stats.map(([n, u], i) => {
        const o = p(t, 0.9 + i * 0.7, 0.45);
        return (
          <div key={u} style={{position: 'absolute', left: 980, top: 230 + i * 200, opacity: o, transform: `translateX(${(1 - o) * 60}px)`}}>
            <Big style={{fontSize: 150, color: C.acc, display: 'inline'}}>{n}</Big>
            <Big style={{fontSize: 56, display: 'inline', marginLeft: 18}}>{u}</Big>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ================= ② 痛点：手工做视频的活，一件件压上来 =================
const Pain = ({vo, t, thumbs, art}) => {
  if (t < T.pain - 0.3 || t > T.turn + 0.2) return null;
  const tasks = [['重新录屏', '重新录屏'], ['写口播稿', '写口播'], ['配音', '配音'], ['93 张截图 × 每一句话', '九十三张截图']];
  const fade = 1 - p(t, T.turn - 0.35, 0.3);
  const flood = p(t, vo.at('v2_pain', '九十三张截图'), 2.5);       // 截图铺满：信息过载
  const days = vo.at('v2_pain', '光剪辑');
  return (
    <AbsoluteFill style={{opacity: fade * p(t, T.pain - 0.3, 0.3)}}>
      <div style={{position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 6, padding: 20, opacity: 0.55 * flood}}>
        {thumbs.slice(0, 96).map((n, i) => (
          <Img key={n + i} src={staticFile(`img/thumbs/${n}.jpg`)} style={{width: '100%', height: 120, objectFit: 'cover', borderRadius: 4, opacity: clamp(flood * 96 - i)}} />
        ))}
      </div>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(16,19,22,.35), rgba(16,19,22,.92) 70%)'}} />
      <PainIntro vo={vo} t={t} art={art} until={vo.at('v2_pain', '重新录屏') - 0.25} />
      <div style={{position: 'absolute', left: 200, top: 210}}>
        {tasks.map(([label, kw], i) => {
          const o = p(t, vo.at('v2_pain', kw) - 0.1, 0.35);
          return (
            <div key={label} style={{opacity: o, transform: `translateY(${(1 - o) * -40}px) scale(${1.15 - 0.15 * o})`, transformOrigin: 'left center', marginBottom: 26,
              display: 'flex', alignItems: 'center', gap: 22, fontFamily: SANS}}>
              <div style={{width: 34, height: 34, borderRadius: 8, border: `3px solid ${C.sub}`}} />
              <div style={{fontSize: 64, fontWeight: 700, color: C.ink}}>{label}</div>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: 180, top: 300, textAlign: 'right', opacity: p(t, days, 0.4)}}>
        <Big style={{fontSize: 46, color: C.sub, fontWeight: 600}}>光剪辑，又是</Big>
        <Big style={{fontSize: 190, color: C.acc, lineHeight: 1}}>{Math.min(3, 1 + Math.floor(clamp((t - days) / 1.2) * 3))} 天</Big>
      </div>
    </AbsoluteFill>
  );
};


// 痛点开头：手机里的文章想被更多人看到（一圈圈扩散、观众点亮起）→ 就得做成视频（空的显示器亮起，等你去录）
const PainIntro = ({vo, t, art, until}) => {
  if (t > until + 0.4) return null;
  const seeAt = vo.at('v2_pain', '更多人'), vidAt = vo.at('v2_pain', '做成视频');
  const out = 1 - p(t, until, 0.35);
  const ph = p(t, T.pain - 0.2, 0.5);
  const mon = p(t, vidAt - 0.1, 0.45);
  const at = {x: 330, y: 150};
  const cx = at.x + PH.w * 0.72 / 2, cy = at.y + PH.h * 0.72 / 2;
  const S = {x: 1060, y: 330, w: 620, h: 349};
  return (
    <AbsoluteFill style={{opacity: out}}>
      {[0, 1, 2].map((i) => {
        const k = clamp((t - seeAt - i * 0.45) / 1.6);
        return k > 0 && <div key={i} style={{position: 'absolute', left: cx - 160 - k * 360, top: cy - 160 - k * 360, width: 320 + k * 720, height: 320 + k * 720,
          borderRadius: '50%', border: `2px solid ${C.acc}`, opacity: 0.45 * (1 - k)}} />;
      })}
      {Array.from({length: 26}, (_, i) => {
        const a = i * 2.39996, r = 330 + (i % 5) * 46;
        const o = p(t, seeAt + 0.15 + i * 0.035, 0.3);
        return <div key={i} style={{position: 'absolute', left: cx + Math.cos(a) * r - 13, top: cy + Math.sin(a) * r * 0.8 - 13, width: 26, height: 26, borderRadius: 13,
          background: i % 3 ? '#3A4046' : C.acc, opacity: o * 0.85, transform: `scale(${o})`}} />;
      })}
      <div style={{position: 'absolute', left: at.x, top: at.y, transform: `scale(${0.72 * lerp(0.92, 1, ph)})`, transformOrigin: 'top left', opacity: ph}}>
        <Phone art={art} scroll={1500 + (t - T.pain) * 120} style={{left: 0, top: 0}} />
      </div>
      <div style={{position: 'absolute', left: 820, top: S.y + S.h / 2 - 50, fontSize: 90, color: C.acc, opacity: p(t, vidAt - 0.25, 0.3), transform: `translateX(${(1 - p(t, vidAt - 0.25, 0.4)) * -40}px)`}}>→</div>
      <Monitor S={S} style={{opacity: mon, transform: `translateY(${(1 - mon) * 40}px)`}}>
        <div style={{position: 'absolute', inset: 0, background: '#0A0C0E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 18}}>
          <div style={{fontFamily: MONO, fontSize: 26, color: C.sub, display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{width: 16, height: 16, borderRadius: 8, background: C.acc, opacity: Math.floor(t * 2) % 2 ? 1 : 0.25}} />REC 00:00:00
          </div>
          <div style={{fontFamily: SANS, fontSize: 24, color: '#5A6168'}}>还没开始录</div>
        </div>
      </Monitor>
    </AbsoluteFill>
  );
};

// ================= ③ 转折：黑屏，一条命令 =================
const Turn = ({t}) => {
  if (t < T.turn || t >= T.drop) return null;
  const cmd = './a2v fetch https://mp.weixin.qq.com/s/6BJ8c999...';
  const n = Math.floor(clamp((t - T.turn - 0.55) / 2.0) * cmd.length);
  const z = clamp((t - T.enter - 0.05) / (T.drop - T.enter));      // 回车后命令行向镜头冲过来
  return (
    <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 50%, rgba(16,19,22,.55), rgba(6,8,10,.92) 75%)', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{fontFamily: MONO, fontSize: 46, color: C.ink, transform: `scale(${1 + 5 * z * z})`, filter: `blur(${z * 8}px)`, opacity: 1 - z * 0.8}}>
        <span style={{color: C.acc}}>$ </span>{cmd.slice(0, n)}
        <span style={{opacity: Math.floor(t * 2.5) % 2 ? 1 : 0, background: C.ink}}>&nbsp;</span>
      </div>
    </AbsoluteFill>
  );
};
// 回车落拍的转场：光速线从中心向外射出 + 中心一团白光，下一幕从景深里浮出（不用整屏亮色闪）
const Warp = ({t}) => {
  const a = T.drop - 0.15, d = 0.65;
  if (t < a || t > a + d) return null;
  const k = (t - a) / d, o = Math.sin(Math.PI * k);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,.6), rgba(221,251,120,.14) 22%, rgba(0,0,0,0) 55%)', opacity: o * 0.85}} />
      {Array.from({length: 72}, (_, i) => {
        const ang = (i * 137.508) % 360, sp = 0.55 + ((i * 53) % 40) / 40;
        return <div key={i} style={{position: 'absolute', left: 960, top: 540, width: lerp(30, 520, k) * sp, height: i % 5 ? 2 : 3, transformOrigin: '0 50%',
          transform: `rotate(${ang}deg) translateX(${lerp(40, 1500, ease(k * sp))}px)`, opacity: o,
          background: `linear-gradient(90deg, rgba(255,255,255,0), ${i % 4 ? 'rgba(255,255,255,.85)' : C.acc})`}} />;
      })}
    </AbsoluteFill>
  );
};

// ================= ④ 英雄段：左手机（文章）↔ 右显示器（视频），讲同一处 =================
const Hero = ({art, vo, film, t}) => {
  if (t < T.drop || t > T.dialogEnd + 0.5) return null;
  const at = {x: 150, y: 110};                                     // 手机位置
  const S0 = {x: 760, y: 170, w: 1010, h: 488};                    // 显示器屏幕（比 16:9 矮，裁掉成片自带字幕）
  const S1 = {x: 290, y: 150, w: 1340, h: 754};                    // 原声段：放大成完整 16:9（上方留给「成片原声」标识）
  const flyAt = vo.at('v4_hero', '你截图上');
  const cmdAt = vo.at('v4_hero', '每一条命令');
  const syncAt = vo.at('v4_hero', '都会在讲到');
  const enter = p(t, T.drop, 0.6);
  const ez = ease((t - T.drop) / 0.6);
  const dp = easeIO((t - (T.dialog - 0.5)) / 0.6);
  const S = {x: lerp(S0.x, S1.x, dp), y: lerp(S0.y, S1.y, dp), w: lerp(S0.w, S1.w, dp), h: lerp(S0.h, S1.h, dp)};
  const sc = S0.w / 1920;                                          // 成片画面在屏幕里的缩放

  // 文章块
  const b029 = art.fly;
  const bCmd = art.blocks.find((b) => b.t === 'p' && b.text.includes('nslookup bookdot.cn'));
  const top = (y) => 48 + y - 40;
  const center = (b) => Math.min(48 + b.y + b.h / 2 - VIEW_H / 2, art.height + 300 - VIEW_H);
  // 手机滚动：DNS 小节（和视频同一张插画）→ 「添加记录」截图 → nslookup 命令
  const scroll = interpolate(t, [T.drop, flyAt - 0.9, flyAt - 0.1, cmdAt - 0.7, cmdAt - 0.1], [top(art.dnsY), top(art.dnsY), center(b029), center(b029), center(bCmd)],
    {easing: easeIO, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hl = (b) => (b.t === 'h' && b.y === art.dnsY && t < flyAt - 0.9) || (b.t === 'img' && b.id === '018' && t < flyAt - 0.9)
    || (b.t === 'img' && b.id === b029.id && t > flyAt - 0.4 && t < cmdAt - 0.7) || (b === bCmd && t > cmdAt - 0.25);

  // 显示器里播的成片：与手机同一处内容
  const segs = [
    {a: T.drop, clip: 'dns', from: 26.3},                         // DNS「对暗号」插画（文章图 018）
    {a: flyAt + 0.55, clip: 'dns', from: 78.4},                   // 「添加记录」表单（文章图 029，成片 78.4s 起完整显示）
    {a: cmdAt + 0.3, clip: 'cmd', from: 6.6},                     // 终端 nslookup（飞到一半先切屏，命令落在终端上）
    {a: T.dialog - 0.5, clip: DIALOG.clip, from: DIALOG.from - 0.5}, // 成片原声
  ];
  const seg = [...segs].reverse().find((s) => t >= s.a);
  const cur = CLIP[seg.clip].film + seg.from + (t - seg.a);

  // 飞：截图 029 从手机飞到显示器（落在成片里这张图的位置）
  const fp = easeIO((t - flyAt) / 0.6);
  const src = pageRect(at, center(b029), b029.y, b029.h);
  const dst = {x: S0.x + 508 * sc, y: S0.y + 112 * sc, w: 904 * sc, h: 748 * sc};   // 成片里这张图的位置（逐帧量得）
  // 飞：命令从手机飞到显示器里终端的位置
  const cp = easeIO((t - cmdAt) / 0.6);
  const csrc = pageRect(at, center(bCmd), bCmd.y, 46);
  const cdst = {x: S0.x + 305 * sc, y: S0.y + 268 * sc};

  const bubbles = [['主讲', '你就把它想象成一个对暗号的小本本。'], ['提问', '懂了，所以设置 DNS，就是把暗号写进小本本？']];
  const below = S0.y + S0.h + BZ + CHIN + 90;
  return (
    <AbsoluteFill style={{opacity: 1 - p(t, T.dialogEnd, 0.4), ...(ez < 1 ? {transform: `scale(${lerp(1.2, 1, ez)})`, filter: `blur(${lerp(14, 0, ez)}px)`} : {})}}>
      <Label style={{left: at.x + 6, top: at.y - 56, opacity: enter * (1 - dp)}}>文章 · 公众号</Label>
      <Phone art={art} scroll={scroll} hl={hl} style={{left: at.x, top: at.y, opacity: enter * (1 - dp), transform: `translateX(${(1 - enter) * -80 - dp * 300}px)`}} />

      <Label style={{left: S.x - BZ + 6, top: S.y - BZ - 56, opacity: enter * (1 - dp)}}>视频 · 自动生成</Label>
      {/* 成片原声：顶部大标识 + 说话人随声音点亮，让观众一眼知道「现在听到的是成片本身」 */}
      {dp > 0.01 && (() => {
        const lt = t - T.dialog + DIALOG.from;
        const spk = lt > DIALOG.B[0] && lt < DIALOG.B[1] ? 'B' : lt > DIALOG.A[0] && lt < DIALOG.A[1] ? 'A' : null;
        const bo = p(t, T.dialog - 0.45, 0.45);
        const Eq = ({on}) => (
          <span style={{display: 'inline-flex', gap: 4, alignItems: 'flex-end', height: 26, marginRight: 12}}>
            {[0, 1, 2, 3].map((i) => <span key={i} style={{width: 5, borderRadius: 2, background: 'currentColor', height: on ? 8 + 18 * Math.abs(Math.sin(t * 9 + i * 1.7)) : 6}} />)}
          </span>
        );
        return (
          <div style={{position: 'absolute', left: 0, right: 0, top: 46, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 26, opacity: bo, transform: `scale(${lerp(1.3, 1, bo)})`}}>
            <div style={{display: 'flex', alignItems: 'center', background: C.acc, color: C.dark, fontFamily: SANS, fontWeight: 800, fontSize: 38, padding: '10px 30px', borderRadius: 999, boxShadow: '0 12px 40px rgba(221,251,120,.3)'}}><Eq on={!!spk} />成片原声</div>
            <div style={{fontFamily: SANS, fontSize: 30, color: C.ink}}>工具直接生成，未经剪辑</div>
            {[['B', '提问 · 男'], ['A', '主讲 · 女']].map(([w, lab]) => (
              <div key={w} style={{display: 'flex', alignItems: 'center', fontFamily: SANS, fontSize: 26, fontWeight: 700, padding: '8px 20px', borderRadius: 999,
                border: `2px solid ${spk === w ? C.acc : C.line}`, color: spk === w ? C.acc : C.sub}}><Eq on={spk === w} />{lab}</div>
            ))}
          </div>
        );
      })()}
      <Monitor S={S} stand={1 - dp} style={{opacity: enter, transform: `translateX(${(1 - enter) * 80}px)`}}>
        <Sequence key={seg.a} from={Math.round(seg.a * FPS)} layout="none">
          <OffthreadVideo src={staticFile(CLIP[seg.clip].src)} startFrom={Math.round(seg.from * FPS)} muted style={{width: '100%', display: 'block'}} />
        </Sequence>
        {dp < 0.5 && <PlayerBar cur={cur} total={film.duration} />}
      </Monitor>

      {/* 两个人的对话（「写成两个人的对话」）——在显示器下方，不压画面 */}
      {bubbles.map(([who, text], i) => {
        const o = p(t, vo.at('v4_hero', '写成两个人') + i * 0.5, 0.4) * (1 - p(t, flyAt - 0.4, 0.3));
        return (
          <div key={i} style={{position: 'absolute', left: S0.x + (i ? 160 : 0), top: below + i * 70, opacity: o, transform: `translateY(${(1 - o) * 20}px)`, display: 'flex', alignItems: 'center', gap: 14, fontFamily: SANS}}>
            <div style={{background: i ? '#fff' : C.acc, color: C.dark, fontWeight: 800, fontSize: 20, padding: '4px 12px', borderRadius: 999}}>{who}</div>
            <div style={{background: C.panel, color: C.ink, fontSize: 28, padding: '10px 20px', borderRadius: 14, border: `1px solid ${C.line}`}}>{text}</div>
          </div>
        );
      })}

      {/* 同步刻度：第一支成片里 206 处「画面跟着口播出现」的真实位置，播放头扫过就点亮 */}
      {t > syncAt - 0.2 && t < T.dialog - 0.3 && (() => {
        const head = clamp((t - syncAt) / 1.6);
        const o = p(t, syncAt - 0.2, 0.3) * (1 - p(t, T.dialog - 0.6, 0.3));
        return (
          <div style={{position: 'absolute', left: S0.x, top: below + 6, width: S0.w, opacity: o}}>
            <div style={{position: 'relative', height: 40}}>
              {film.syncs.map((s, i) => {
                const lit = s / film.duration < head;
                return <div key={i} style={{position: 'absolute', left: (s / film.duration) * S0.w, width: 3, top: lit ? 0 : 14, height: lit ? 40 : 12, background: lit ? C.acc : C.line}} />;
              })}
              <div style={{position: 'absolute', left: head * S0.w - 1, top: -8, width: 2, height: 56, background: '#fff'}} />
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 14, fontFamily: SANS, fontSize: 24, color: C.sub}}>
              <span>00:00</span><span><span style={{color: C.acc, fontFamily: MONO}}>{film.syncs.filter((s) => s / film.duration < head).length}</span> 处画面跟着口播出现</span><span>{fmt(film.duration)}</span>
            </div>
          </div>
        );
      })()}

      {/* 飞出的截图 */}
      {t > flyAt - 0.05 && t < flyAt + 0.8 && (
        <Img src={staticFile(`img/${b029.id}.png`)} style={{position: 'absolute', left: lerp(src.x, dst.x, fp), top: lerp(src.y, dst.y, fp), width: lerp(src.w, dst.w, fp), height: lerp(src.h, dst.h, fp),
          borderRadius: 6, boxShadow: `0 30px 80px rgba(0,0,0,.6), 0 0 0 ${lerp(5, 2, fp)}px ${C.acc}`, opacity: 1 - p(t, flyAt + 0.6, 0.2)}} />
      )}
      {/* 飞出的命令 */}
      {t > cmdAt - 0.05 && t < cmdAt + 1.5 && (
        <div style={{position: 'absolute', left: lerp(csrc.x, cdst.x, cp), top: lerp(csrc.y, cdst.y, cp), fontFamily: MONO, fontSize: lerp(14, 36 * sc, cp) * (1 + 0.5 * Math.sin(Math.PI * cp)), fontWeight: 700, whiteSpace: 'nowrap',
          color: C.dark, background: C.acc, padding: '2px 8px', borderRadius: 4, boxShadow: '0 16px 40px rgba(0,0,0,.6)', opacity: 1 - p(t, cmdAt + 1.0, 0.25)}}>nslookup bookdot.cn</div>
      )}
    </AbsoluteFill>
  );
};

// ================= ⑤ 掌控：五步依次成为主角，每一步都是真实产物在动 =================
const ScriptLine = ({l}) => {
  const m = l.match(/\*\*(?:🅰️|🅱️)\s*(.+?)\*\*：(.*)/);
  if (l.startsWith('##')) return <div style={{color: C.acc, fontWeight: 700, fontSize: 28}}>{l.replace(/^##\s*/, '')}</div>;
  if (!m && l.startsWith('*')) return <div style={{color: C.sub, fontSize: 20}}>{l.replace(/\*/g, '')}</div>;
  if (!m) return <div style={{height: 6}} />;
  return (
    <div style={{display: 'flex', gap: 12, alignItems: 'baseline'}}>
      <span style={{flex: 'none', background: m[1] === '主讲' ? C.acc : '#fff', color: C.dark, fontWeight: 800, fontSize: 17, padding: '2px 10px', borderRadius: 999}}>{m[1] === '主讲' ? '主讲' : '提问'}</span>
      <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{m[2]}</span>
    </div>
  );
};
const CardBody = ({i, lt, script}) => {
  if (i === 0) {
    const cmd = './a2v fetch https://mp.weixin.qq.com/s/6BJ8…';
    const n = Math.round(93 * clamp((lt - 0.45) / 0.4));
    return (
      <div style={{padding: '40px 44px', fontFamily: MONO, fontSize: 34, color: C.ink, lineHeight: 2.1}}>
        <div><span style={{color: C.acc}}>$ </span>{cmd.slice(0, Math.floor(clamp(lt / 0.45) * cmd.length))}</div>
        {lt > 0.45 && <div style={{color: C.sub}}>下载图片 <span style={{display: 'inline-block', width: 360, height: 16, background: C.line, verticalAlign: 'middle', borderRadius: 7}}><span style={{display: 'block', width: `${(n / 93) * 100}%`, height: 16, background: C.acc, borderRadius: 7}} /></span> {n}/93</div>}
        {lt > 0.85 && <div><span style={{color: C.acc}}>✓</span> 正文 6378 字，图片 93 张（宽 ≥1920 的 37 张）</div>}
      </div>
    );
  }
  if (i === 1) return (
    <div style={{padding: '26px 40px', fontFamily: SANS, fontSize: 27, color: C.ink, lineHeight: 1.8}}>
      {script.slice(0, 9).map((l, j) => <div key={j} style={{opacity: clamp((lt - j * 0.07) / 0.15)}}><ScriptLine l={l} /></div>)}
    </div>
  );
  if (i === 2) {
    const r = clamp(lt / 0.75);
    return (
      <div style={{padding: '30px 36px'}}>
        <div style={{fontFamily: MONO, fontSize: 22, color: C.sub}}>chunk_01.wav · 13:57 · 两个人的完整对话，一次生成</div>
        <div style={{position: 'relative', marginTop: 40}}>
          <Img src={staticFile('img/real_waveform.png')} style={{width: '100%', height: 300, objectFit: 'cover', display: 'block', opacity: 0.18}} />
          <Img src={staticFile('img/real_waveform.png')} style={{position: 'absolute', inset: 0, width: '100%', height: 300, objectFit: 'cover', clipPath: `inset(0 ${(1 - r) * 100}% 0 0)`}} />
          <div style={{position: 'absolute', top: -10, bottom: -10, left: `${r * 100}%`, width: 3, background: '#fff'}} />
        </div>
      </div>
    );
  }
  if (i === 3) {
    const y = clamp(lt / 0.8);
    return (
      <div style={{position: 'relative', height: 516, overflow: 'hidden'}}>
        <Img src={staticFile('img/real_redbox.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', transform: `scale(${1 + 0.06 * y})`}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: `${y * 100}%`, height: 90, marginTop: -90, background: 'linear-gradient(rgba(221,251,120,0), rgba(221,251,120,.35))', borderBottom: `3px solid ${C.acc}`}} />
      </div>
    );
  }
  const n = Math.round(25139 * ease(lt / 0.9));
  return (
    <div style={{position: 'relative', height: 516}}>
      <Img src={staticFile('img/real_qa.jpg')} style={{width: '100%', height: 440, objectFit: 'cover', display: 'block'}} />
      <div style={{height: 76, display: 'flex', alignItems: 'center', gap: 30, padding: '0 30px', fontFamily: MONO, fontSize: 26, color: C.ink}}>
        <span>已检查 <span style={{color: C.acc}}>{n.toLocaleString()}</span> 帧</span><span>黑帧 <span style={{color: C.acc}}>0</span> 处 {n === 25139 ? '✓' : ''}</span>
      </div>
    </div>
  );
};
const Control = ({t, script, vo}) => {
  if (t < T.control - 0.2 || t > T.proof + 0.3) return null;
  const out = 1 - p(t, T.proof - 0.3, 0.35);
  const names = ['抓取文章', '口播脚本', '生成配音', '安排画面', '渲染成片'];
  const titles = ['终端', 'script.md', 'chunk_01.wav', '截图红框识别', '质检'];
  const k = [1, 2, 3, 4].reduce((s, i) => s + easeIO((t - STEP[i] + 0.2) / 0.4), 0);   // 当前主角（连续值）
  const r = easeIO((t - ROW) / 0.4);
  const gateAt = [vo.at('v5b_gates', '脚本'), vo.at('v5b_gates', '配音'), vo.at('v5b_gates', '成片')];                                                       // 收拢成一排
  const CW = 1100, CH = 560, RS = 0.29;
  return (
    <AbsoluteFill style={{opacity: out * p(t, T.control - 0.2, 0.3)}}>
      <Big style={{position: 'absolute', left: 0, right: 0, top: 60, textAlign: 'center', fontSize: 60}}>5 步，<span style={{color: C.acc}}>文章变视频</span></Big>
      {/* 步骤条 1 → 5 */}
      <div style={{position: 'absolute', left: 400, width: 1120, top: 186, height: 4, background: C.line}}><div style={{width: `${(Math.min(4, k + r) / 4) * 100}%`, height: 4, background: C.acc}} /></div>
      {names.map((nm, i) => {
        const on = Math.round(k) === i && r < 0.5, done = k + r * 5 > i + 0.5;
        return (
          <div key={nm} style={{position: 'absolute', left: 400 + i * 280 - 80, width: 160, top: 164, textAlign: 'center', fontFamily: SANS}}>
            <div style={{margin: '0 auto', width: 48, height: 48, borderRadius: 24, background: on || done ? C.acc : C.panel, border: `3px solid ${on || done ? C.acc : C.line}`,
              color: on || done ? C.dark : C.sub, fontWeight: 800, fontSize: 24, lineHeight: '42px', boxSizing: 'border-box', transform: `scale(${on ? 1.15 : 1})`}}>{i + 1}</div>
            <div style={{marginTop: 10, fontSize: 24, color: on ? C.ink : C.sub, fontWeight: on ? 700 : 400}}>{nm}{GATES.includes(i) ? ' ✋' : ''}</div>
          </div>
        );
      })}
      {/* 这一步用的命令 */}
      {t > STEP[0] - 0.3 && r < 0.6 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 282, textAlign: 'center', fontFamily: MONO, fontSize: 30, color: C.ink, opacity: p(t, STEP[0] - 0.3, 0.4) * (1 - r * 1.6)}}>
          <span style={{color: C.acc}}>$ </span>{CMDS[Math.min(4, Math.round(k))]}
        </div>
      )}
      {names.map((nm, i) => {
        const d = Math.abs(i - k);
        const s = lerp(1 - 0.2 * Math.min(1, d), RS, r);
        const x = lerp((1920 - CW) / 2 + (i - k) * 1180, 112 + i * (CW * RS + 25), r);
        const y = lerp(340 + (CH * (1 - s)) / 2, 470, r);
        const o = lerp(clamp(1 - 0.7 * d), 1, r) * (i === 0 ? p(t, STEP[0] - 0.3, 0.45) : 1);
        const lt = (t - STEP[i] + 0.2) * 0.75;
        if (o <= 0.01) return null;
        return (
          <div key={nm} style={{position: 'absolute', left: x, top: y, width: CW, height: CH, transform: `scale(${s})`, transformOrigin: 'top left', opacity: o, zIndex: 10 - Math.round(d)}}>
            <Window title={`${i + 1} · ${titles[i]}`} style={{width: CW, height: CH, boxShadow: '0 40px 120px rgba(0,0,0,.6)', borderColor: d < 0.5 && r < 0.5 ? '#4A4A4A' : C.line}}>
              <CardBody i={i} lt={lt} script={script} />
            </Window>
          </div>
        );
      })}
      {/* 旁白点到哪一步，哪一步盖章 */}
      {GATES.map((i, j) => {
        const g = p(t, gateAt[j], 0.3);
        return g > 0 && <div key={i} style={{position: 'absolute', left: 112 + i * (CW * RS + 25) + CW * RS - 250, top: 400, width: 250, height: 80}}><Stamp o={g} /></div>;
      })}
      <div style={{position: 'absolute', left: 0, right: 0, top: 680, textAlign: 'center', fontFamily: SANS, fontSize: 36, color: C.ink, opacity: p(t, vo.at('v5b_gates', '这三步') - 0.1, 0.4)}}>
        脚本 · 配音 · 成片 —— <span style={{color: C.acc}}>你确认了，再往下走</span>
      </div>
      {/* 「哪里不对当场改，不用推倒重来」 */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, fontFamily: SANS, fontSize: 30}}>
        {[['哪里不对', '哪里不对'], ['当场改', '当场改'], ['不用推倒重来', '不用推倒']].map(([label, kw], i) => {
          const o = p(t, vo.at('v5b_gates', kw) - 0.1, 0.35);
          return (
            <React.Fragment key={label}>
              {i > 0 && <span style={{color: C.acc, opacity: o}}>→</span>}
              <span style={{opacity: o, transform: `translateY(${(1 - o) * 14}px)`, display: 'inline-block', padding: '8px 22px', borderRadius: 999,
                border: `2px solid ${i === 2 ? C.acc : C.line}`, color: i === 2 ? C.acc : C.ink, background: C.panel}}>{i === 1 ? '✎ ' : ''}{label}</span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 850, textAlign: 'center', fontFamily: SANS, fontSize: 22, color: C.sub, opacity: p(t, ROW + 0.4, 0.4)}}>以上全部是第一支成片的真实产物</div>
    </AbsoluteFill>
  );
};

// ================= ⑥ 证明：一篇文章 → 一支 14 分钟的视频，四个数字都可视化 =================
const MiniPhone = () => (
  <div style={{width: 64, height: 120, borderRadius: 14, background: C.body, boxShadow: 'inset 0 0 0 2px #3A3A3A', padding: 5, boxSizing: 'border-box'}}>
    <div style={{width: '100%', height: '100%', borderRadius: 9, background: '#fff', padding: '12px 7px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6}}>
      {[1, 0.8, 1, 0.6, 1, 0.9].map((w, i) => <div key={i} style={{width: `${w * 100}%`, height: 5, background: i === 2 ? '#BBB' : '#DDD', borderRadius: 2}} />)}
    </div>
  </div>
);
const MiniMonitor = () => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
    <div style={{width: 200, height: 118, borderRadius: 10, background: C.body, boxShadow: 'inset 0 0 0 2px #3A3A3A', padding: 6, boxSizing: 'border-box'}}>
      <div style={{width: '100%', height: '100%', borderRadius: 5, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{width: 0, height: 0, borderLeft: `22px solid ${C.acc}`, borderTop: '13px solid transparent', borderBottom: '13px solid transparent'}} />
      </div>
    </div>
    <div style={{width: 40, height: 14, background: '#1E1E1E'}} /><div style={{width: 100, height: 6, borderRadius: 3, background: '#1E1E1E'}} />
  </div>
);
const Tile = ({a, t, num, label, children}) => {
  const o = p(t, a, 0.4);
  return (
    <div style={{width: 400, height: 600, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden', position: 'relative', opacity: o, transform: `translateY(${(1 - o) * 50}px)`}}>
      <div style={{position: 'absolute', left: 20, top: 20, width: 360, height: 370}}>{children}</div>
      <Big style={{position: 'absolute', left: 28, top: 410, fontSize: 104, fontFamily: MONO, color: num === '0' ? C.acc : C.ink, lineHeight: 1}}>{num}</Big>
      <div style={{position: 'absolute', left: 30, top: 530, fontFamily: SANS, fontSize: 28, color: C.sub}}>{label}</div>
    </div>
  );
};
const Proof = ({t, film}) => {
  if (t < T.proof - 0.2 || t > T.cta + 0.3) return null;
  const out = 1 - p(t, T.cta - 0.3, 0.35);
  const A = [0.83, 1.33, 1.83, 2.33].map((x) => T.proof + x);
  const shotsN = Math.round(28 * clamp((t - A[0] - 0.2) / 0.9));
  const syncN = Math.round(film.syncs.length * clamp((t - A[1] - 0.2) / 1.2));
  const wave = clamp((t - A[2] - 0.5) / 0.8);
  return (
    <AbsoluteFill style={{opacity: out}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 70, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 44, fontFamily: SANS}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: p(t, T.proof, 0.4)}}>
          <MiniPhone /><div><div style={{fontSize: 30, color: C.sub}}>一篇图文</div><Big style={{fontSize: 56}}>6,400 字 · 93 图</Big></div>
        </div>
        <div style={{fontSize: 72, color: C.acc, opacity: p(t, T.proof + 0.5, 0.3), transform: `translateX(${(1 - p(t, T.proof + 0.5, 0.4)) * -40}px)`}}>→</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 24, opacity: p(t, T.proof + 0.9, 0.4), transform: `scale(${0.92 + 0.08 * p(t, T.proof + 0.9, 0.5)})`}}>
          <MiniMonitor /><div><div style={{fontSize: 30, color: C.sub}}>一支视频</div><Big style={{fontSize: 96, color: C.acc, lineHeight: 1.05}}>14 分钟</Big></div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 125, top: 300, display: 'flex', gap: 30}}>
        <Tile a={A[0]} t={t} num={String(shotsN)} label="个镜头，自动排好">
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 84px)', gap: 8}}>
            {Array.from({length: 28}, (_, j) => (
              <Img key={j} src={staticFile(`img/shots/${String(j + 1).padStart(2, '0')}.jpg`)} style={{width: 84, height: 44, objectFit: 'cover', borderRadius: 3, opacity: j < shotsN ? 1 : 0.06, transform: `scale(${j < shotsN ? 1 : 0.8})`}} />
            ))}
          </div>
        </Tile>
        <Tile a={A[1]} t={t} num={String(syncN)} label="处画面跟着口播出现">
          {Array.from({length: 14}, (_, m) => (
            <div key={m} style={{position: 'absolute', left: 0, top: m * 26 + 4, width: 360, height: 18}}>
              <div style={{position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: C.line}} />
              {film.syncs.map((s, j) => (Math.floor(s / 60) === m ? (
                <div key={j} style={{position: 'absolute', left: ((s % 60) / 60) * 356, top: 0, width: 3, height: 18, background: j < syncN ? C.acc : 'transparent'}} />
              ) : null))}
            </div>
          ))}
        </Tile>
        <Tile a={A[2]} t={t} num="1" label="次配音调用，整段生成">
          <div style={{fontFamily: MONO, fontSize: 22, color: C.ink, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 18px', marginTop: 20}}>
            <span style={{color: C.acc}}>→</span> TTS 请求 × 1
          </div>
          <div style={{textAlign: 'center', color: C.sub, fontSize: 30, margin: '10px 0'}}>↓</div>
          <div style={{position: 'relative', height: 150}}>
            <Img src={staticFile('img/real_waveform.png')} style={{width: '100%', height: 150, objectFit: 'cover', clipPath: `inset(0 ${(1 - wave) * 100}% 0 0)`}} />
          </div>
          <div style={{fontFamily: SANS, fontSize: 22, color: C.sub, marginTop: 14}}>13:57 · 两个人的完整对话</div>
        </Tile>
        <Tile a={A[3]} t={t} num="0" label="次打开剪辑软件">
          <div style={{position: 'relative', height: 370, opacity: 0.9}}>
            <div style={{display: 'flex', gap: 34, fontFamily: MONO, fontSize: 14, color: '#555', marginTop: 20}}>{['00:00', '03:30', '07:00', '10:30'].map((x) => <span key={x}>{x}</span>)}</div>
            {['视频', '配音', '字幕', '音乐'].map((tr) => (
              <div key={tr} style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 18}}>
                <div style={{width: 46, fontFamily: SANS, fontSize: 16, color: '#555'}}>{tr}</div>
                <div style={{flex: 1, height: 44, borderRadius: 6, border: '2px dashed #333'}} />
              </div>
            ))}
            <div style={{position: 'absolute', left: 0, right: 0, top: 150, textAlign: 'center', opacity: p(t, A[3] + 0.5, 0.3), transform: `rotate(-8deg) scale(${lerp(1.4, 1, p(t, A[3] + 0.5, 0.3))})`}}>
              <span style={{fontFamily: SANS, fontWeight: 800, fontSize: 34, color: C.acc, border: `3px solid ${C.acc}`, borderRadius: 10, padding: '6px 18px', background: 'rgba(11,11,11,.85)'}}>不用剪</span>
            </div>
          </div>
        </Tile>
      </div>
    </AbsoluteFill>
  );
};

// ================= ⑦ 收尾 =================
const CTA = ({t, vo}) => {
  if (t < T.cta) return null;
  const l1 = p(t, vo.at('v6b_tag', '让文章') - 0.1, 0.5), l2 = p(t, vo.at('v6b_tag', '被看见') - 0.1, 0.5);
  const tagOut = 1 - p(t, T.logo - 0.35, 0.35);
  const name = 'article-to-video';
  const typed = name.slice(0, Math.floor(clamp((t - T.logo) / 0.9) * name.length));
  const fin = t >= T.final;                                           // 彩蛋之后定格回来
  const s1 = fin ? 1 : p(t, vo.at('v7_cta', '文章进去') - 0.1, 0.5), os = fin ? 1 : p(t, vo.at('v7_cta', '开源免费') - 0.1, 0.4), s2 = fin ? 1 : p(t, vo.at('v7_cta', '开源免费') + 0.5, 0.5);
  const blockO = t < T.making ? 1 - p(t, T.making - 0.35, 0.35) : p(t, T.final, 0.6);
  return (
    <AbsoluteFill>
      {t < T.logo && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 330, textAlign: 'center', opacity: tagOut}}>
          <div style={{fontFamily: SERIF, fontSize: 120, fontWeight: 700, color: C.ink, opacity: l1, transform: `translateY(${(1 - l1) * 30}px)`}}>让文章，</div>
          <div style={{fontFamily: SERIF, fontSize: 120, fontWeight: 700, color: C.acc, marginTop: 30, opacity: l2, transform: `translateY(${(1 - l2) * 30}px)`}}>被看见！</div>
        </div>
      )}
      {t >= T.logo && blockO > 0.001 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 200, textAlign: 'center', opacity: blockO}}>
          <div style={{fontFamily: MONO, fontSize: 128, fontWeight: 700, color: C.ink, letterSpacing: -2}}>
            {fin ? name : typed}<span style={{color: C.acc, opacity: Math.floor(t * 2.5) % 2 ? 1 : 0}}>_</span>
          </div>
          <div style={{fontFamily: SANS, fontSize: 52, fontWeight: 600, color: C.ink, marginTop: 30, opacity: s1, transform: `translateY(${(1 - s1) * 20}px)`}}>文章进去，<span style={{color: C.acc}}>视频出来。</span></div>
          <div style={{display: 'inline-block', marginTop: 34, fontFamily: SANS, fontSize: 30, fontWeight: 700, color: C.acc, border: `2px solid ${C.acc}`, borderRadius: 999, padding: '6px 28px', opacity: os, transform: `scale(${lerp(1.3, 1, os)})`}}>开源 · 免费</div>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, marginTop: 50, opacity: s2}}>
            <div style={{fontFamily: MONO, fontSize: 32, color: C.ink}}>github.com/clarkzoe2026-a11y/article-to-video</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
              <div style={{width: 110, height: 110, background: '#fff', borderRadius: 12, padding: 7, boxSizing: 'border-box'}}><Img src={staticFile('img/qr.jpg')} style={{width: '100%', height: '100%'}} /></div>
              <div style={{fontFamily: SANS, fontSize: 22, color: C.sub, lineHeight: 1.5, textAlign: 'left'}}>公众号<br /><span style={{color: C.acc, fontFamily: SERIF, fontSize: 32}}>漫行书海</span></div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};



// ================= ⑧ 彩蛋：这支宣传片也是 AI 写代码、聊出来的 =================
// 左：这支宣传片自己的源代码在滚动；右：和 AI 的对话（本片制作中用户真实提过的修改意见，转述）；最后盖章「0 次剪辑软件」
const CHAT = [
  ['我', '做一支宣传片，放 GitHub 和社交媒体'],
  ['AI', '先分析项目真正的价值，再定结构'],
  ['我', '背景不要纯黑，要有空间感'],
  ['AI', '改成深色舞台：柔光 + 透视网格'],
  ['我', '5 步太快了，观众反应不过来'],
  ['AI', '每步放慢到 4 秒，讲清楚怎么用'],
  ['我', '这条横线太明显，去掉'],
  ['AI', '已去掉，重新渲染 ✓'],
];
const Making = ({t, vo, code}) => {
  if (t < T.making - 0.2 || t > T.final + 0.3) return null;
  const inO = p(t, T.making, 0.5), out = 1 - p(t, T.final - 0.4, 0.4);
  const codeAt = vo.at('v8_making', 'AI'), chatAt = vo.at('v8_making', '全程聊'), zeroAt = vo.at('v8_making', '没用任何');
  const scroll = Math.max(0, t - codeAt + 1.2) * 150;                  // 代码一直往上滚
  const shown = Math.floor(clamp((t - chatAt + 0.6) / 2.4) * CHAT.length);
  const z = p(t, zeroAt - 0.05, 0.35);
  const kw = /\b(const|return|export|import|from|if)\b/;
  return (
    <AbsoluteFill style={{opacity: inO * out}}>
      <Big style={{position: 'absolute', left: 0, right: 0, top: 64, textAlign: 'center', fontSize: 52}}>这支宣传片，<span style={{color: C.acc}}>也是聊出来的</span></Big>
      <Window title="engine/src/promo/Promo.jsx" style={{position: 'absolute', left: 110, top: 170, width: 1060, height: 700, transform: `translateY(${(1 - inO) * 40}px)`}}>
        <div style={{position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflow: 'hidden'}}>
          <div style={{transform: `translateY(${-scroll}px)`, padding: '18px 24px', fontFamily: MONO, fontSize: 17, lineHeight: 1.65, whiteSpace: 'pre'}}>
            {code.map((l, i) => (
              <div key={i} style={{display: 'flex', gap: 18, color: l.trim().startsWith('//') ? '#6F7A84' : kw.test(l) ? C.acc : '#C8CED4'}}>
                <span style={{color: '#3E4851', width: 34, textAlign: 'right', flex: 'none'}}>{i + 1}</span><span>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </Window>
      <Window title="和 AI 的对话" style={{position: 'absolute', left: 1200, top: 170, width: 610, height: 700, transform: `translateY(${(1 - inO) * 40}px)`}}>
        <div style={{position: 'absolute', top: 64, left: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: SANS, fontSize: 24}}>
          {CHAT.slice(0, Math.max(1, shown)).map(([who, text], i) => (
            <div key={i} style={{alignSelf: who === '我' ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '10px 18px', borderRadius: 16,
              background: who === '我' ? C.acc : '#20262B', color: who === '我' ? C.dark : C.ink, opacity: i < shown ? 1 : 0.0001}}>{text}</div>
          ))}
        </div>
      </Window>
      {z > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', justifyContent: 'center'}}>
          <div style={{transform: `scale(${lerp(1.6, 1, z)}) rotate(${lerp(-12, -5, z)}deg)`, opacity: clamp(z * 3), background: 'rgba(16,19,22,.92)', border: `4px solid ${C.acc}`, borderRadius: 18,
            padding: '20px 44px', fontFamily: SANS, fontWeight: 800, fontSize: 64, color: C.acc, boxShadow: '0 30px 80px rgba(0,0,0,.6)'}}>0 次剪辑软件</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================= 背景：有空间感的深色舞台（不用纯黑）=================
// 顶部一束柔光 + 远处的透视地面网格 + 两团缓慢漂移的环境光 + 暗角；不画地平线横线（用户 2026-10-08：太明显）
// 作者的知识视频系列共用同一套背景（那边是 SVG 版组件），改动要两边同步
const Backdrop = ({t}) => (
  <AbsoluteFill style={{overflow: 'hidden'}}>
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 90% 70% at 50% 30%, #1E2428 0%, #14181C 45%, #0C0F12 100%)'}} />
    <div style={{position: 'absolute', left: -600, right: -600, top: 560, height: 1400, perspective: 900, perspectiveOrigin: '50% 0%'}}>
      <div style={{position: 'absolute', inset: 0, transform: 'rotateX(74deg)', transformOrigin: '50% 0%',
        backgroundImage: 'linear-gradient(rgba(221,251,120,.10) 2px, transparent 2px), linear-gradient(90deg, rgba(221,251,120,.10) 2px, transparent 2px)',
        backgroundSize: '120px 120px', backgroundPosition: `0 ${(t * 24) % 120}px`,
        maskImage: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,.9) 40%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,.9) 40%, rgba(0,0,0,0) 100%)'}} />
    </div>
    <div style={{position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', left: 200 + Math.sin(t / 7) * 160, top: -500 + Math.cos(t / 9) * 80,
      background: 'radial-gradient(circle, rgba(221,251,120,.10), rgba(221,251,120,0) 65%)'}} />
    <div style={{position: 'absolute', width: 1200, height: 1200, borderRadius: '50%', left: 1000 + Math.cos(t / 8) * 160, top: 200 + Math.sin(t / 6) * 90,
      background: 'radial-gradient(circle, rgba(120,160,200,.10), rgba(120,160,200,0) 65%)'}} />
    <AbsoluteFill style={{background: 'radial-gradient(ellipse 75% 75% at 50% 45%, rgba(0,0,0,0) 55%, rgba(4,6,8,.65) 100%)'}} />
  </AbsoluteFill>
);

// ================= 声音：旁白 + 音乐（骤停 → 高潮接入）+ 音效 =================
const Sound = ({tl, vo}) => {
  const voWin = tl.scenes.map((s) => [T.vo[s.id] - 0.2, T.vo[s.id] - s.lines[0].start + s.lines[0].end + 0.2]);
  const speaking = (t) => voWin.some(([a, b]) => t > a && t < b);
  const duck = (t, base) => (t > T.dialog - 0.3 && t < T.dialogEnd ? base * 0.08 : speaking(t) ? base * 0.42 : base);
  const sfx = (name, at, vol = 0.6, dur = 2) => (
    <Sequence key={name + at} from={Math.round(at * FPS)} durationInFrames={Math.round(dur * FPS)}><Audio src={staticFile(`sfx/${name}.mp3`)} volume={vol} /></Sequence>
  );
  return (
    <>
      {tl.scenes.map((s) => (
        <Sequence key={s.id} from={Math.round((T.vo[s.id] - s.lines[0].start) * FPS)}><Audio src={staticFile(s.audio)} volume={1} /></Sequence>
      ))}
      <Sequence from={0} durationInFrames={Math.round((T.turn + 0.3) * FPS)}>
        <Audio src={staticFile(MUSIC)} volume={(f) => duck(f / FPS, 0.5) * (1 - clamp((f / FPS - (T.turn - 0.15)) / 0.4))} />
      </Sequence>
      <Sequence from={Math.round(T.drop * FPS)}>
        <Audio src={staticFile(MUSIC)} startFrom={Math.round(DROP_OFFSET * FPS)} volume={(f) => { const t = T.drop + f / FPS; return duck(t, 0.55) * (1 - clamp((t - (MUSIC_LOOP - 0.5)) / 0.6)); }} />
      </Sequence>
      <Sequence from={Math.round((MUSIC_LOOP - 0.1) * FPS)}>
        <Audio src={staticFile(MUSIC)} startFrom={Math.round(DROP_OFFSET * FPS)} volume={(f) => { const t = MUSIC_LOOP - 0.1 + f / FPS; return duck(t, 0.55) * clamp((t - MUSIC_LOOP + 0.1) / 0.3) * (1 - clamp((t - (T.end - 2.6)) / 2.4)); }} />
      </Sequence>
      <Sequence from={Math.round(T.dialog * FPS)} durationInFrames={Math.round(DIALOG.len * FPS)}>
        <Audio src={staticFile(CLIP[DIALOG.clip].src)} startFrom={Math.round(DIALOG.from * FPS)} volume={(f) => 1.15 * clamp(f / 3) * clamp((DIALOG.len * FPS - f) / 3)} />
      </Sequence>
      {sfx('whoosh', T.pain - 0.25, 0.35)}
      {sfx('typing', T.turn + 0.5, 0.45, 2.1)}
      {sfx('click', T.enter, 0.8, 1)}
      {sfx('impact', T.drop - 0.05, 0.7, 3)}
      {sfx('whoosh', vo.at('v4_hero', '你截图上') - 0.05, 0.3)}
      {sfx('whoosh', vo.at('v4_hero', '每一条命令') - 0.05, 0.25)}
      {sfx('whoosh', T.control - 0.25, 0.35)}
      {['脚本', '配音', '成片'].map((kw) => sfx('select', vo.at('v5b_gates', kw), 0.5, 1))}
      {sfx('whoosh', T.proof - 0.25, 0.35)}
      {sfx('whoosh', T.cta - 0.25, 0.35)}
      {sfx('whoosh', T.making - 0.25, 0.3)}
      {sfx('select', vo.at('v8_making', '没用任何'), 0.5, 1)}
      {sfx('whoosh', T.final - 0.25, 0.25)}
    </>
  );
};

export const Promo = ({timeline, article, scriptExcerpt, thumbs, film, code = []}) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  if (!timeline) return <AbsoluteFill style={{background: C.bg}} />;
  const vo = makeVo(timeline);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Backdrop t={t} />
      <Sound tl={timeline} vo={vo} />
      {t < T.pain + 0.1 && <Hook art={article} t={t} />}
      <Pain vo={vo} t={t} thumbs={thumbs} art={article} />
      <Turn t={t} />
      <Hero art={article} vo={vo} film={film} t={t} />
      <Control t={t} script={scriptExcerpt} vo={vo} />
      <Proof t={t} film={film} />
      <CTA t={t} vo={vo} />
      <Making t={t} vo={vo} code={code} />
      <Warp t={t} />
      {!(t > T.dialog - 0.3 && t < T.dialogEnd) && !(t > T.turn && t < T.drop) && !(t > T.cta - 0.1 && t < T.making) && t < T.final && <Captions tl={timeline} t={t} />}
    </AbsoluteFill>
  );
};
