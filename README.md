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

## 一键安装

需要：macOS 或 Linux、Node.js 18+、[uv](https://docs.astral.sh/uv/)（推荐）或 Python 3.10–3.12、一个 [Gemini API Key](https://aistudio.google.com/apikey)（免费）。

```bash
git clone https://github.com/clarkzoe2026-a11y/article-to-video.git
cd article-to-video
./install.sh
```

`install.sh` 会装好渲染引擎（约 0.5 GB）、Python 环境（PyTorch + WhisperX，约 1 GB）、分句数据，并引导你填 Gemini Key 和片尾显示的公众号名。可重复运行。第一次生成配音时，还会自动下载约 1.3 GB 的中文语音对齐模型（只下载一次）——它负责算出每个字在第几秒，让画面逐字跟着口播走，全部在本机运行。合计约 3 GB 磁盘空间。

## 5 步，文章变视频

```bash
./a2v new 2026-11-my-topic
./a2v fetch articles/2026-11-my-topic <文章链接或 .md 文件>
```

然后让你的 AI 编程助手（Claude Code、Codex、Cursor……）读 `WORKFLOW.md`，按流程做这篇文章：

1. **抓取文章**（`./a2v fetch`）：正文和截图一起拿下来。支持：
   - **飞书文档**：图片最清晰（需先登录飞书官方命令行工具 `lark-cli`）
   - **微信公众号文章**
   - **其他网页文章**：个人博客、CSDN、少数派、GitHub Blog、Substack、Wikipedia 等，外文文章也可以
   - **本地 Markdown / 文本文件**：文中引用的图片会一起导入。知乎、Medium 这类拒绝自动访问或需要登录的网站，把文章另存为 Markdown 再导入
2. **口播脚本**：把文章改写成两个人的对话 → **你审稿**（关卡 1）。
3. **生成配音**（`./a2v voice`）：先听 1 分钟试听段，再整段对话一次配好 → **你听整片**（关卡 2）。
4. **安排画面**（`./a2v shots`）：讲到哪张截图，就推近哪个红框。
5. **渲染成片**（`./a2v render`）：自动检查，一条命令出片 → **你看成片**（关卡 3）。

另外还能生成视频平台的分段章节（`./a2v chapters`）。想自己动手也可以，全部命令见 `./a2v`。

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
