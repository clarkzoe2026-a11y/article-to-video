<div align="center">

# article-to-video

<a href="README.md"><img alt="简体中文" src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-DDFB78?style=for-the-badge"></a> <a href="README.en.md"><img alt="English" src="https://img.shields.io/badge/English-2E2E2E?style=for-the-badge"></a>

<a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue"></a> <img alt="Remotion" src="https://img.shields.io/badge/Remotion-4-0B84F3"> <img alt="Gemini TTS" src="https://img.shields.io/badge/Gemini-TTS-8E75B2"> <img alt="WhisperX" src="https://img.shields.io/badge/WhisperX-alignment-555555">

</div>

**让文章，被看见。** 把一篇图文文章，变成一支 16:9 的知识讲解视频：两个人的对话讲给观众听，你截图上的每一个红框、每一条命令，都在讲到它的那一秒出现。开源、免费、本地运行。

https://github.com/user-attachments/assets/5d34f792-62aa-4bdd-bc87-736896126135

> 🎬 上面是本项目的宣传片（87 秒）——它本身也是用代码做的，没开过剪辑软件。
>
> 📺 用它做的 14 分钟实战成片：[《AI 建网站不再被平台拿捏：零基础搬上服务器》（视频号）](https://weixin.qq.com/sph/AyngTzgEvD)

## 它能做什么

- **双人对话口播**：主讲（女声）+ 提问（男声），提问者替观众问出卡点；用 Gemini TTS 免费版，整片配音一次生成。
- **说到哪，画面就到哪**：WhisperX 逐字对齐，每个画面切换都绑定台词里的关键词，渲染前自动校验。
- **截图会讲解**：自动识别你在截图上标的红框，先展示全图再推近，光标移过去点击。
- **还有**：终端逐行打出命令、状态码卡片、流程图、大数字、剪入视频片段、片尾公众号卡片。
- **三道人工关卡**：脚本、配音、成片都由你确认了再往下走；哪里不对当场改，不用推倒重来。
- **自动质检**：黑帧扫描（有就自动重渲）、配音切点检查、每个画面抽帧拼成缩略图墙，交给你之前先自检。

## 快速开始：3 步

### 第 1 步：准备两样东西

| 需要 | 怎么获得 |
|---|---|
| **一个 AI 编程助手** | [Claude Code](https://claude.com/claude-code)、[Codex](https://github.com/openai/codex)、[Cursor](https://cursor.com)、[WorkBuddy](https://www.workbuddy.ai) 等，装好并登录。要选能在你电脑上运行命令、读写文件的助手（WorkBuddy 用 Craft 模式） |
| **一个 Gemini API Key**（免费，用来配音） | 用 Google 账号登录 [Google AI Studio](https://aistudio.google.com/apikey)，点 **Create API key**，复制保存好 |

电脑需要是 Mac 或 Linux（暂不支持 Windows），并装有 [Node.js](https://nodejs.org)（18 或更新）。没装也没关系，助手检查到会告诉你怎么装。

### 第 2 步：把一句话发给 AI 编程助手

在电脑上新建一个空文件夹（比如「视频工作室」），用 AI 编程助手打开它，复制下面这句话发给它，把尖括号换成你的文章：

```text
帮我下载并安装 https://github.com/clarkzoe2026-a11y/article-to-video
然后按它的 WORKFLOW.md 流程，把这篇文章做成视频：<文章链接或 .md 文件路径>
```

助手会自己下载、安装（首次几分钟，约占 3 GB 空间），然后开始做视频。中途有两件事要你亲手做：

- **填 Gemini Key**：助手会请你在自己的「终端」里运行一条命令，把 Key 粘贴进去。**不要把 Key 发到对话里**，它只保存在你自己电脑上。
- **允许联网**：抓文章、安装、配音都要联网。如果助手默认不让联网（比如 Codex 的默认安全模式），请在助手里允许联网；WorkBuddy 请用能直接执行的 Craft 模式（Ask 模式只聊天，做不了）。

能用的文章：

- **飞书文档**：图片最清晰（需先登录飞书官方命令行工具 `lark-cli`）
- **微信公众号文章**
- **其他网页文章**：个人博客、CSDN、少数派、GitHub Blog、Substack、Wikipedia 等，外文文章也可以
- **本地 Markdown / 文本文件**：文中引用的图片会一起导入。知乎、Medium 这类不让自动访问或要登录的网站，把文章另存为 Markdown 再用

以后再做新视频，用 AI 编程助手打开 `article-to-video` 文件夹，发这句就行：

```text
按 WORKFLOW.md 的流程，把这篇文章做成视频：<文章链接或 .md 文件路径>
```

### 第 3 步：在三道关卡点头

助手会自己一步步做下去，只在三个地方停下来等你：

| 关卡 | 你要做的 |
|---|---|
| ① 口播脚本 | 读一遍稿子，回复「通过」，或者告诉它哪句要改 |
| ② 配音 | 先听 1 分钟试听，再听完整配音，满意就回复「通过」 |
| ③ 成片 | 看缩略图墙和完整视频，满意就回复「通过」 |

做好的视频在 `articles/<文章目录>/out/video.mp4`。

<details>
<summary><b>想自己手动安装？</b>（点开）</summary>

先装好 [Node.js](https://nodejs.org)（18 或更新）和 [uv](https://docs.astral.sh/uv/)（在「终端」里运行 `curl -LsSf https://astral.sh/uv/install.sh | sh`），然后一行一行运行：

```bash
git clone https://github.com/clarkzoe2026-a11y/article-to-video.git
cd article-to-video
./install.sh
```

安装过程中会请你粘贴 Gemini Key（粘贴时屏幕上不显示，粘完按回车），再填片尾要显示的公众号或频道名。第一次用 `git` 时，Mac 会弹窗提示安装开发者工具，点「安装」，装完再运行一次。

占用空间约 3 GB：渲染引擎约 0.5 GB、Python 环境约 1 GB；第一次生成配音时，还会自动下载约 1.3 GB 的中文语音对齐模型（只下载一次）。它负责算出每个字在第几秒，让画面逐字跟着口播走，全部在本机运行。

</details>

## 它是怎么做的（5 步）

1. **抓取文章**（`./a2v fetch`）：正文和截图一起拿下来。
2. **口播脚本**：把文章改写成两个人的对话 → 关卡 ①。
3. **生成配音**（`./a2v voice`）：先出 1 分钟试听段，再整段对话一次配好 → 关卡 ②。
4. **安排画面**（`./a2v shots`）：讲到哪张截图，就推近哪个红框。
5. **渲染成片**（`./a2v render`）：自动检查，一条命令出片 → 关卡 ③。

另外还能生成视频平台的分段章节（`./a2v chapters`）。

**想自己一步步跑命令**也可以，从这两条开始，全部命令见 `./a2v`：

```bash
./a2v new 2026-11-my-topic
./a2v fetch articles/2026-11-my-topic <文章链接或 .md 文件>
```

## 目录

| 路径 | 内容 |
|---|---|
| `WORKFLOW.md` | 流程手册（AI 助手从这里开始） |
| `docs/` | 写稿指南、画面指南、视觉风格、宣传片设计语言、踩坑记录 |
| `a2v` / `install.sh` | 命令入口 / 一键安装 |
| `engine/` | Remotion 渲染引擎（讲解视频模板 + 宣传片专属动画） |
| `pipeline/` | 抓取、配音、对齐、红框识别、画面校验、质检 |
| `articles/` | 示例：一篇 14 分钟实战成片、本项目宣传片的口播稿和画面安排（只含文本，不含原文图片、配音和音乐） |

## 费用

Gemini TTS 免费版每天 10 次调用，一支视频的配音通常 2 次（试听段 + 整片）。其余全部本地运行、免费。

## 作者

微信公众号 **漫行书海** —— 分享 AI 工作流实战。

## License

[MIT](LICENSE)
