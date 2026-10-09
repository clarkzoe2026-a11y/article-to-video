# Article to Video —— 文章转知识视频工作流

> 给任何 Agent（Claude Code、Codex、Cursor……）读的操作手册。用户发来一篇文章链接或正文，按本流程产出一支横屏（16:9）知识讲解视频，发到视频平台（如 B 站）。
> **三道人工关卡必须停下来等用户明确确认，Agent 不得自行放行。**

```
文章链接/正文
   │  ① 抓取素材                         ./a2v new / fetch
   ▼
口播脚本（双人对话稿）                     script/storyboard.json → script.md
   │  ════ 关卡 1：用户确认脚本 ════
   ▼
试听段（开头约 1 分钟）                    ./a2v sample
   │  ════ 关卡 2a：用户确认音色和语速 ════
   ▼
整片配音 + 逐字对齐                        ./a2v voice
   │  ════ 关卡 2b：用户确认整片配音 ════
   ▼
画面安排 → 渲染 → 自动质检                  shots.py → ./a2v render / qa
   │  ════ 关卡 3a：用户看质检缩略图墙和问题清单 ════
   │  ════ 关卡 3b：用户看完整成片 ════
   ▼
发布物料（章节时间点、标题简介、封面）        ./a2v chapters
```

每篇文章一个目录 `articles/<年-月-主题>/`，里面的 **`STATUS.md` 是进度和关卡记录的唯一依据**：换 Agent 接手时先读它，做完一步就更新它。

---

## 0. 开始之前

| 需要 | 说明 |
|---|---|
| `.env`（项目根目录） | `GEMINI_API_KEY=...`。不在仓库里，丢了让用户重新生成。Agent 不得打印、提交或外传 Key |
| 一键安装 | `./install.sh`：Node 依赖、Python 环境、NLTK 数据、Gemini Key、品牌信息（可重复运行） |
| Python 环境 | `./install.sh` 自动创建 `.venv`（WhisperX / PIL / scipy），可用环境变量 `A2V_PYTHON` 覆盖 |
| 浏览器 | 有本机 Google Chrome 就用它渲染；没有时 Remotion 会自动下载自带浏览器（也可用 `A2V_CHROME` 指定） |
| 飞书原图（可选） | `lark-cli`，**只申请只读权限**（见 `pipeline/fetch_article.py` 顶部），用完 `lark-cli auth logout` |

### 第一次使用：Agent 检查环境并自动安装

用户可能只发了一句「帮我下载并安装 <本仓库地址>，然后……把这篇文章做成视频」。按顺序做：

1. **下载**：当前目录还没有本项目时，`git clone` 本仓库并进入目录（macOS 第一次用 git 会弹窗装开发者工具，请用户点「安装」后再试）。
2. **检查**：`node -v`（需 18+）、有没有 `uv`（或 Python 3.10–3.12）、`.venv/bin/python`、`engine/node_modules`、`.env` 里有没有非空的 `GEMINI_API_KEY`（只判断有无，**不打印**）。
3. **缺 Node.js**：请用户到 https://nodejs.org 下载安装包（已有 Homebrew 的可以 `brew install node`）；不要用 `sudo`，也不要替用户输入电脑密码。
4. **缺 uv 且没有合适的 Python**：可以运行官方脚本 `curl -LsSf https://astral.sh/uv/install.sh | sh`（装在用户目录，不需要密码），装完用 `~/.local/bin/uv` 或重开终端。
5. **安装**：运行 `./install.sh`。在 Agent 的非交互终端里它会跳过 Key 和公众号名的提问，其余照常安装（首次几分钟）。
6. **Gemini Key**：**不要让用户把 Key 发到对话里**（对话会被保存）。请用户在自己的终端里进入项目目录运行 `./install.sh`——已装好的部分会跳过，只问 Key 和片尾公众号名；或者用文本编辑器打开 `.env` 写一行 `GEMINI_API_KEY=…`。没有 Key 的用户先去 https://aistudio.google.com/apikey 免费申请。
7. **联网**：抓文章、装依赖、配音都要联网；被助手的安全模式拦住时，请用户在助手里允许联网。
8. 装好后从「1. 抓取素材」开始。

## 1. 抓取素材（Agent 自动）

```bash
./a2v new 2026-11-my-topic
./a2v fetch articles/2026-11-my-topic <飞书链接|公众号链接|其他网页文章链接|本地.md>
```

- **优先用飞书链接**：能拿到高清原图（实测最宽 2880px），公众号最宽只有 1080px，局部放大会糊。
- **其他网页**（个人博客、CSDN、少数派、GitHub Blog、Substack、Wikipedia……）：按「阅读模式」算法提取正文和图片。知乎、Medium 等会拒绝访问（403），需要登录或正文靠脚本显示的页面也抓不全——这时让用户把文章另存为 Markdown（图片放同一文件夹），用 `./a2v fetch <目录> 文章.md` 导入，文中引用的图片会一起导入。
- 外文文章也能抓；口播稿按 `docs/SCRIPT_GUIDE.md` 写成中文对话（相当于中文讲解外文文章）。
- 产出：`source/article.md`、`source/images/`、`public/img/NNN.png`（编号与文中顺序一致）。
- 截图里的隐私信息（IP、账号、手机号）先检查：作者通常已打码，没打码的要提醒用户。

## 2. 写口播脚本（Agent 起草）→ 关卡 1

写作要求见 **`docs/SCRIPT_GUIDE.md`**（必读）。要点：

- **双人对话**：A 主讲（懂行的朋友）+ B 提问（替观众问出卡点）。盲听对比结论：双人对话明显比单人朗读自然。
- 稿子是**为听而写**，不是把文章念一遍；沿用文章自己的比喻。
- 写进 `script/storyboard.json`：每个镜头 `{id, title, visual, images, lines: [["A"|"B", "台词"]]}`。
- `./a2v script <目录>` 生成 `script/script.md` 给用户审。
- 同时填好 `meta.json`（片尾卡片的标题/副标题/封面、视频平台分段章节）。

**关卡 1 —— 停下，请用户审稿。** 向用户说明：镜头数、字数、预计时长；哪些地方是 Agent 自己补充的、原文没有的（需要用户确认事实）；建议重点看的段落。
用户确认后在 `STATUS.md` 记录「关卡 1 通过 + 日期 + 用户原话」。**未通过不得生成配音。**

## 3. 配音（Agent 生成）→ 关卡 2a / 2b

```bash
./a2v sample articles/xxx 300     # 关卡 2a：只生成开头约 300 字试听段 → public/audio/sample.wav
./a2v voice  articles/xxx         # 关卡 2b：整片一次生成 + 逐字对齐 + 按镜头切分
```

- 引擎：Gemini TTS（`gemini-3.8-flash-tts`）双人对话，A=Callirrhoe（「主讲·女」），B=Puck（「提问·男」）。
- **不拼接音频**：始终以对话形式整段生成；串声就整段重新生成并由用户确认，不要把单独生成的句子切开拼进去。
- 用户确认后写 `public/audio/approved.json` 加锁，之后不会被重新生成覆盖。
- **免费版每天只有 10 次调用**，限的是次数不是时长：整片 14 分钟的音频也只算 1 次。所以 `voice` 默认**整片一次调用**；脚本会检查是否被截断（语速异常偏快即报错，再改用 `--chunk-chars 2400` 分组）。
- 配音按台词内容做缓存：台词没改就不会重新调用。
- 对齐用 WhisperX 中文模型做强制对齐（滑动窗口），产出 `build/timeline.json`（每句、每个字的时间）。
- **按镜头切分时，切点在两句之间按波形找最安静的地方**（不按对齐时间取中点，否则会切进下一句第一个字，听起来像「卡字」），切口加 10ms 淡入淡出。验收：每段首尾 50ms 都低于 -45 dB；对内容有疑问时用 faster-whisper 逐段转写核对。
- **单人旁白**（如宣传片）：storyboard 里只有一个角色时自动用单人模式。默认配音风格是讲解视频的（「不要广告腔」）；需要别的风格时，在 `storyboard.json` 里加 `"style": {"A": "……"}` 覆盖（写清语速、节奏、最后一句的语气等）。同一配置每次生成的语速也会有约 10% 的波动，觉得慢就在风格里写明语速后整段重新生成。

**关卡 2a —— 停下，请用户听试听段**（音色、语速、口播感）。通过后再生成整片，避免浪费额度。
**关卡 2b —— 停下，只把完整配音交给用户听**（用户 2026-10-08：不需要提供提问者合集）；`voicecheck` 只作 Agent 自检参考（可直接听 `public/audio/chunk_01.wav`）。重点：读错的字、数字/IP/英文念法、语气。
发现念法问题 → 改台词写法（如 IP 写成「四七点九八」而不是数值），只重新生成配音。

## 4. 画面 → 渲染 → 质检（Agent）→ 关卡 3a / 3b

写画面安排的方法见 **`docs/SHOTS_GUIDE.md`**。流程：

```bash
./a2v redboxes articles/xxx                         # 自动识别截图上作者标注的红框
./a2v contact  articles/xxx out/c1.jpg 010,011,013  # 带红框序号的缩略图墙，核对用
# 编辑 articles/xxx/shots.py：说到哪句话，画面怎么动
./a2v shots    articles/xxx                         # 生成并校验（关键词必须真的出现在台词里）
./a2v render   articles/xxx                         # 渲染 out/video.mp4 + 黑帧扫描（必须 0 处）
./a2v qa       articles/xxx                         # 每个画面停稳时抽一帧 → out/review/sheetNN.jpg + index.txt
```

**Agent 自检（交给用户之前必须做完）：**
1. `shots` 校验全部通过；`render` 黑帧扫描 0 处。
2. 逐张看 `out/review/` 缩略图墙，对照 `index.txt` 的口播：框选位置对不对、画面和口播是否同步、面板是否挡住顶栏、字幕是否正确。
3. 把发现的问题列成清单，能修的先修完再渲染。

**关卡 3a —— 停下，把缩略图墙和问题清单给用户看**（几分钟就能看完，大问题在这里拦下）。
**关卡 3b —— 停下，把成片给用户看。** 用户的每条意见：改 → 重新 `render` → 重新 `qa` → 再交付。
用户确认后在 `STATUS.md` 记录「关卡 3 通过」。

## 5. 发布物料（Agent）

```bash
./a2v chapters articles/xxx    # 视频平台分段章节（如 B 站）→ out/chapters.txt（来自 meta.json 的 chapters）
```

还可以提供：视频平台的标题/简介草稿（含公众号文章链接）、封面建议。**发布动作由用户自己做**，Agent 不代发。

**宣传片 / 推广视频**不走讲解模板：设计语言见 `docs/PROMO_STYLE.md`（手机 = 文章、显示器 = 视频、空间舞台背景、文案说结果且必须真实），示例实现见 `engine/src/promo/Promo.jsx` 与 `articles/2026-10-promo-article-to-video/`。

---

## 规则（所有 Agent 必须遵守）

- **关卡不能跳**：用户没明确说通过，就不进入下一步。「看起来没问题」不等于通过。
- **事实以原文为准**：稿子里原文没有的事实（数字、步骤、价格）要标出来让用户确认。
- **改了什么就更新 `STATUS.md`**，包括失败和遗留问题；不要只在聊天里说。
- **成本意识**：配音每次调用都消耗免费额度，生成前先说明会用几次。
- **隐私**：不提交真实姓名、个人邮箱、本机用户名/绝对路径；如果仓库里有 `registry/commit-identity.json`，提交身份必须与它一致（`githooks/` 会自动检查）；否则至少确认 `git config user.name/user.email` 不是真名和个人邮箱。
- **不要提交**：`.env`、`node_modules`、`out/*.mp4`、`public/audio/*.wav`、`build/`（可重新生成）。

## 更多文档

| 文档 | 内容 |
|---|---|
| `docs/SCRIPT_GUIDE.md` | 双人口播稿怎么写（含口语化规则、念法规范） |
| `docs/SHOTS_GUIDE.md` | 画面安排怎么写（触发、四种画面、面板、红框坐标） |
| `docs/STYLE.md` | 视觉风格（配色、字体、字幕、动画节奏） |
| `docs/LESSONS.md` | 踩过的坑和原因（闪烁、黑帧、对不上……） |
| `docs/STATUS_TEMPLATE.md` | 每篇文章的进度模板 |
| `articles/2026-10-ai-website-to-server/` | 第一支完整成片的全部材料，可当范例 |
