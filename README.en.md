<div align="center">

# article-to-video

<a href="README.md"><img alt="简体中文" src="https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-2E2E2E?style=for-the-badge"></a> <a href="README.en.md"><img alt="English" src="https://img.shields.io/badge/English-DDFB78?style=for-the-badge"></a>

<a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue"></a> <img alt="Remotion" src="https://img.shields.io/badge/Remotion-4-0B84F3"> <img alt="Gemini TTS" src="https://img.shields.io/badge/Gemini-TTS-8E75B2"> <img alt="WhisperX" src="https://img.shields.io/badge/WhisperX-alignment-555555">

</div>

**Let your articles be seen.** Turn an illustrated article into a 16:9 explainer video: two hosts talk your readers through it, and every red box on your screenshots and every command in your text appears on screen the moment it is mentioned. Open source, free, runs locally.

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

## Install

Requirements: macOS or Linux, Node.js 18+, [uv](https://docs.astral.sh/uv/) (recommended) or Python 3.10–3.12, and a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/clarkzoe2026-a11y/article-to-video.git
cd article-to-video
./install.sh
```

`install.sh` installs the render engine (about 0.5 GB), the Python environment (PyTorch + WhisperX, about 1 GB) and sentence-splitting data, then asks for your Gemini key and the account name shown on the end card. Safe to re-run. The first time you generate a voice, it also downloads a Chinese speech-alignment model (about 1.3 GB, once) — it works out the timing of every character so the picture can follow the narration, entirely on your machine. About 3 GB of disk in total.

## 5 steps from article to video

```bash
./a2v new 2026-11-my-topic
./a2v fetch articles/2026-11-my-topic <article URL or .md file>
```

Then ask your AI coding assistant (Claude Code, Codex, Cursor, …) to read `WORKFLOW.md` and follow it for this article:

1. **Fetch the article** (`./a2v fetch`): text and screenshots, downloaded together. Sources:
   - **Feishu (Lark) docs**: sharpest images (log in with Feishu's official CLI `lark-cli` first)
   - **WeChat Official Account articles**
   - **Other web articles**: personal blogs, GitHub Blog, Substack, Wikipedia, dev.to, CSDN, Sspai…
   - **Local Markdown / text files**, with the images they reference. For sites that block automated access or need a login (e.g. Medium, Zhihu), save the article as Markdown and import that.
2. **Write the script**: the article rewritten as a two-person dialogue → **you review it** (gate 1).
3. **Generate the voice** (`./a2v voice`): listen to a 1-minute sample, then the full dialogue is voiced in one go → **you listen to it** (gate 2).
4. **Arrange the shots** (`./a2v shots`): whichever screenshot is being discussed, zoom into its red box.
5. **Render** (`./a2v render`): automatic checks, one command to the final video → **you watch it** (gate 3).

It can also generate chapter markers for video platforms (`./a2v chapters`). Prefer to do it by hand? All commands are listed by `./a2v`.

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
