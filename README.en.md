<div align="center">

# article-to-video

<a href="README.md"><img alt="简体中文" src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-2E2E2E?style=for-the-badge"></a> <a href="README.en.md"><img alt="English" src="https://img.shields.io/badge/English-DDFB78?style=for-the-badge"></a>

<a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue"></a> <img alt="Remotion" src="https://img.shields.io/badge/Remotion-4-0B84F3"> <img alt="Gemini TTS" src="https://img.shields.io/badge/Gemini-TTS-8E75B2"> <img alt="WhisperX" src="https://img.shields.io/badge/WhisperX-alignment-555555">

</div>

**Let your articles be seen.** Turn an illustrated article into a 16:9 explainer video: two hosts talk your readers through it, and every red box on your screenshots and every command in your text appears on screen the moment it is mentioned. Open source, free, runs locally (Mac / Linux) — one message in Claude Code, Codex, Cursor, WorkBuddy or another AI coding assistant.

https://github.com/user-attachments/assets/5d34f792-62aa-4bdd-bc87-736896126135

> 🎬 The project's promo video (87 s, narrated in Chinese) — made entirely in code, no video editor opened.
>
> 📺 A full 14-minute video made with it: [Moving an AI-built website onto your own server, step by step (WeChat Channels, in Chinese)](https://weixin.qq.com/sph/AyngTzgEvD)

## What it does

- **Two-voice dialogue narration**: a presenter (female) and a questioner (male) who asks the questions your viewers would ask. Uses the Gemini TTS free tier; the whole narration is generated in one call.
- **The picture follows the narration**: WhisperX aligns the audio character by character; every visual change is bound to a keyword in the script and checked before rendering.
- **Screenshots that explain themselves**: detects the red boxes you drew on your screenshots, shows the full image first, then zooms in and moves a cursor to click.
- **And more**: commands typed out in a terminal, status-code cards, flow diagrams, big numbers, embedded video clips, an end card with your account.
- **Three human review gates**: you approve the script, the voice and the final video before moving on; fix anything on the spot instead of starting over.
- **Automatic QA**: black-frame scan (with automatic re-render), narration cut-point checks, and a contact sheet of every shot — checked before it reaches you.

## Quick start

### Step 1: install (once)

Have a voice API ready: this project uses a **Gemini API key (free tier)** — [get one here](https://aistudio.google.com/apikey). Then send this to your AI coding assistant:

```text
Download and install https://github.com/clarkzoe2026-a11y/article-to-video
```

The assistant downloads and installs everything. You only do two things: enter your key when asked (never in the chat) and allow internet access when asked.

<details>
<summary><b>Prefer to install it yourself?</b> (click to expand)</summary>

Install [Node.js](https://nodejs.org) (18+) and [uv](https://docs.astral.sh/uv/) (run `curl -LsSf https://astral.sh/uv/install.sh | sh` in Terminal), then run these lines one at a time:

```bash
git clone https://github.com/clarkzoe2026-a11y/article-to-video.git
cd article-to-video
./install.sh
```

The installer asks you to paste your Gemini key (nothing shows while you paste — just press Enter) and the account name for the end card. The first time you use `git`, macOS offers to install its developer tools — click Install, then run the line again.

About 3 GB of disk: render engine ~0.5 GB, Python environment ~1 GB, plus a Chinese speech-alignment model (~1.3 GB) downloaded automatically the first time you generate a voice. It works out the timing of every character so the picture follows the narration — entirely on your machine.

</details>

### Step 2: make a video

Send this to your AI coding assistant, with your article in the angle brackets (in a new conversation, open the `article-to-video` folder in your assistant first):

```text
Follow WORKFLOW.md and turn this article into a video: <article URL or path to a .md file>
```

Articles you can use: Feishu (Lark) docs, WeChat articles, other web articles (any language), local Markdown files. For sites that can't be fetched (e.g. Medium, Zhihu), save the article as Markdown first.

The assistant works through the steps by itself and only stops at three gates for you:

| Gate | What you do |
|---|---|
| ① Script | Read it, reply "approved", or say which lines to change |
| ② Voice | Listen to a 1-minute sample, then the full narration; reply "approved" when happy |
| ③ Video | Check the contact sheet and the full video; reply "approved" when happy |

Your video ends up in `articles/<article folder>/out/video.mp4`.

## How it works (5 steps)

1. **Fetch the article** (`./a2v fetch`): text and screenshots, downloaded together.
2. **Write the script**: the article rewritten as a two-person dialogue → gate ①.
3. **Generate the voice** (`./a2v voice`): a 1-minute sample first, then the full dialogue voiced in one go → gate ②.
4. **Arrange the shots** (`./a2v shots`): whichever screenshot is being discussed, zoom into its red box.
5. **Render** (`./a2v render`): automatic checks, one command to the final video → gate ③.

It can also generate chapter markers for video platforms (`./a2v chapters`).

**Prefer to run the commands yourself?** Start with these two; `./a2v` lists them all:

```bash
./a2v new 2026-11-my-topic
./a2v fetch articles/2026-11-my-topic <article URL or .md file>
```

> **Language note**: the narration prompts, the voices and the workflow docs (`WORKFLOW.md`, `docs/`) are written and tuned for Mandarin Chinese videos. AI coding assistants read them fine; for other languages you would adapt the script guide and the TTS style prompts.

## Layout

| Path | Contents |
|---|---|
| `WORKFLOW.md` | The workflow handbook (your AI assistant starts here) |
| `docs/` | Script guide, shot guide, visual style, promo design language, lessons learned |
| `a2v` / `install.sh` | Command entry point / one-step install |
| `engine/` | Remotion render engine (explainer template + the promo's bespoke animation) |
| `pipeline/` | Fetching, voice, alignment, red-box detection, shot validation, QA |
| `articles/` | Examples: a 14-minute hands-on video and this project's promo — scripts and shot plans only (no original images, voice or music) |

## Cost

The Gemini TTS free tier allows 10 calls a day; one video usually needs 2 (a sample plus the full narration). Everything else runs locally for free.

## Author

WeChat Official Account **漫行书海** — hands-on AI workflows.

## License

[MIT](LICENSE)
