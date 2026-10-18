# Funk — a fun VS Code extension that reacts when your code fails 💀

![Funk](assets/funk.png)

**Funk** watches your code as it runs. When a command, script, or task exits with a
failure, Funk instantly:

1. **plays your sound** (a "womp womp" beep by default),
2. **shows your image** over the editor (a dead-skull "CODE FAILED" face by default), and
3. **animates it** — zoom, shake, bounce, spin… your pick — then fades out.

Ship it to a teammate and every `SyntaxError`, `Segfault`, or `exit code 1` becomes a
shared joke instead of a silent facepalm.

> 📦 Install it as a `.vsix` and it works the second it's loaded — **default image and
> sound are bundled**, so nobody has to hunt for assets to test it.

---

## Contents

- [Features](#features)
- [How error detection works (and its limits)](#how-error-detection-works-and-its-limits)
- [Installation](#installation)
- [30-second test](#30-second-test)
- [Configuration](#configuration)
- [Using your own image and sound](#using-your-own-image-and-sound)
- [Image vs. sound only (`funk.mode`)](#image-vs-sound-only-funkmode)
- [Commands](#commands)
- [Architecture](#architecture)
- [Development](#development)
- [Packaging & publishing](#packaging--publishing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

| Feature | Detail |
| --- | --- |
| 🔊 Reliable audio | Sound plays from the **extension host** (via `ffplay` or Windows Media Player on Windows, `afplay` on macOS, `ffplay`/`paplay`/`mpg123` on Linux) — not subject to the webview autoplay policy that silently blocks most webview audio tricks. |
| 💀 Visual overlay | A dark, centered overlay in the editor area. VS Code can't draw floating UI above the whole workbench, so Funk covers the **editor column** and optionally **maximizes** it (`funk.coverEditor`), restoring your layout after. |
| 🎬 6 animations | `shake`, `bounce`, `spin`, `zoom`, `shake-bounce` (default), `chaos`. |
| 🖼 Custom image | Any PNG/JPG/GIF/SVG path. GIFs animate. Near-square images look best. |
| 🔊 Custom sound | MP3 / WAV / OGG path. |
| 🎛 Playback mode | All-in, image-only (silent), or sound-only. |
| 🧯 Error summary | Echoes the first error-looking line (`ReferenceError: x is not defined`, `Traceback...`, `panic: ...`) — never a wall of output. Off with `funk.showTerminalErrors`. |
| ⏳ Anti-spam | Cooldown (default 4s) + 1.5s identical-error dedupe: one failed command = one Funk. |
| 📊 Status bar | `Funk: ON/OFF` — click to toggle. |
| 🔒 Hardened webview | CSP `default-src 'none'`, resources only from whitelisted roots, one nonce'd inline script for playback fallback. |

---

## How error detection works (and its limits)

Funk uses **only real VS Code APIs** — it does not pretend a universal
"execution failed" event exists (it doesn't):

1. **Terminal commands** — `window.onDidStartTerminalShellExecution` /
   `window.onDidEndTerminalShellExecution`. Shell integration (on by default for
   PowerShell, bash, zsh, fish) provides the **exit code**, and `execution.read()`
   streams command output so Funk can grab a one-line error summary.
2. **Tasks** — `tasks.onDidEndTaskProcess` gives the exit code of task executions
   (`npm run build`, `make`, custom tasks).

**Honest limitations:**

- Shells **without** VS Code shell integration can't be observed — no exit code ever
  reaches any extension. Funk stays silent rather than guessing.
- `exitCode` can be `undefined` if the shell dies mid-command; Funk does not trigger.
- Debug sessions don't expose an exit code (`onDidTerminateDebugSession`), so
  debug-run failures are intentionally not detected.
- Editor red squiggles (diagnostics) are **not** a trigger — static analysis isn't an
  execution failure.
- `exit code 1` from `grep`/`diff` is a status, not an error. Set
  `funk.triggerOnExitCode: false` to require error-like output before triggering.

---

## Installation

### From a built VSIX (recommended)

```powershell
# Build once
npm install --include=dev
npm run compile
npm run package          # -> funk-1.x.x.vsix

code --install-extension funk-1.x.x.vsix
```

> `npm install --include=dev` matters in CI shells where `NODE_ENV=production` makes
> npm silently skip dev dependencies.

### From source / development

```powershell
git clone https://github.com/YasirAminBrohi/funk.git
cd funk
npm install --include=dev
```

Then open the folder in VS Code and press **F5** to launch an Extension Development
Host with Funk loaded, or run `npm run package` and install the produced VSIX.

**Requirements:** VS Code ≥ 1.93, Node ≥ 18.

---

## 30-second test

1. `Ctrl+Shift+P` (⌘⇧P on macOS) → **Funk: Test** — you should see your image shake and
   hear the sound.
2. Or fail for real:

   ```bash
   node -e "console.log(undefinedVariable)"
   ```

   Funk pops, animates, plays the sound, and fades out after ~3 seconds.

> After installing or changing asset settings, run **Developer: Reload Window** if
> needed, then **Funk: Reload Assets** to pick up swapped files.

---

## Configuration

All settings are under the `funk` scope (User or Workspace settings):

| Setting | Default | Meaning |
| --- | --- | --- |
| `funk.enabled` | `true` | Master switch (also togglable from the status bar). |
| `funk.mode` | `image-and-sound` | `image-and-sound`, `image-only` (silent), or `sound-only` (no visual). |
| `funk.image` | `""` | Custom image path (absolute, or workspace-relative). Empty = bundled default. |
| `funk.sound` | `""` | Custom sound path. Empty = bundled default. |
| `funk.duration` | `3000` | Overlay lifetime in ms (500–30000). |
| `funk.volume` | `1.0` | Sound volume `0`–`1`. |
| `funk.animation` | `shake-bounce` | `shake`, `bounce`, `spin`, `zoom`, `shake-bounce`, `chaos`. |
| `funk.showTerminalErrors` | `true` | Include the captured error summary line in the overlay. |
| `funk.cooldown` | `4000` | Minimum ms between two Funk reactions. |
| `funk.coverEditor` | `true` | Maximize the editor area while the overlay shows, so it covers as much of the screen as VS Code allows. |
| `funk.detectTerminal` | `true` | Watch integrated-terminal command exit codes. |
| `funk.detectTasks` | `true` | Watch task exit codes. |
| `funk.triggerOnExitCode` | `true` | `false` = also require error-like output for a non-zero exit (safer for `grep`/`diff`). |

Example `settings.json`:

```jsonc
{
  "funk.enabled": true,
  "funk.image": "C:/Users/me/Pictures/face.png",
  "funk.sound": "C:/Users/me/Music/bruh.mp3",
  "funk.animation": "chaos",
  "funk.volume": 0.7,
  "funk.duration": 4000,
  "funk.mode": "image-and-sound"
}
```

---

## Using your own image and sound

**Option A — settings paths (recommended):**

1. Drop your files anywhere (`C:\Users\me\Pictures\face.png`, a repo, …).
2. Set `funk.image` / `funk.sound` to their absolute paths (or workspace-relative
   paths like `assets/face.png`).
3. Run **Funk: Test**. Changed the files without changing paths? Run
   **Funk: Reload Assets**.

**Option B — replace the bundled defaults permanently:**

1. Overwrite `assets/funk.png` and `assets/funk.mp3` in the installed extension
   folder (`%USERPROFILE%\.vscode\extensions\yasir.funk-<version>\assets\`).
2. **Funk: Reload Assets** (or reload the window). Now custom-less installs use
   your files by default.

GIFs animate; `.mp3`, `.wav`, and `.ogg` all play. Funk folders outside the
extension are whitelisted per-user automatically — no manual security config.

---

## Image vs. sound only (`funk.mode`)

| Mode | What happens on failure |
| --- | --- |
| `image-and-sound` | Overlay (animated image + caption + error line) **and** sound. Default. |
| `image-only` | Overlay only, silent — good for shared offices. |
| `sound-only` | Sound only, no editor takeover at all. |

---

## Commands

| Command | What it does |
| --- | --- |
| `Funk: Test` | Fire Funk on demand (no failure needed). |
| `Funk: Enable` / `Funk: Disable` | Flip `funk.enabled`. |
| `Funk: Toggle` | Toggle (same as clicking the status bar item). |
| `Funk: Reload Assets` | Drop the current overlay and re-read custom asset paths. |

Clicking the **`Funk: ON` / `Funk: OFF`** status bar item toggles Funk.

---

## Architecture

```
src/
  extension.ts        activation & wiring of all monitors + commands
  configuration.ts    typed settings reader + change events
  terminalMonitor.ts  shell-integration exit codes + output stream → error summary
  taskMonitor.ts      task exit codes
  soundPlayer.ts      host-side audio (ffplay / WMP-COM / afplay / paplay / mpg123)
  funkController.ts   cooldown, dedupe, overlay/sound lifecycle
  statusBar.ts        "Funk: ON/OFF" toggle
  commands.ts         command registration
  webview/
    funkPanel.ts      panel creation, resource-root whitelisting, maximize/restore
    funkHtml.ts       CSP-hardened HTML + CSS keyframe animations
assets/               default funk.png + funk.mp3 (works out of the box)
scripts/
  generate-assets.mjs regenerates both default assets (pure Node; lamejs devDep)
```

Detection → `funkController` (cooldown/dedupe gate) → sound via host process per
platform → overlay webview (or sound-only early exit) → auto-close after
`funk.duration`, layout restored if maximized.

---

## Development

```bash
npm install --include=dev
npm run compile         # tsc --noEmit + esbuild bundle -> dist/extension.js
npm run watch           # incremental build
npm run generate-assets # regenerate built-in assets
```

- Press **F5** to run an Extension Development Host.
- Strict TypeScript (`noUncheckedIndexedAccess`, no `any`); esbuild bundling; no
  runtime dependencies.

---

## Packaging & publishing

```bash
npm run package        # -> funk-x.y.z.vsix via vsce
npx vsce publish       # needs a personal-access token for publisher `yasir`
```

`.vscodeignore` keeps `src/`, `scripts/`, `esbuild.js`, `tsconfig.json`, and loose
media files out of the VSIX — it ships only `dist/extension.js` + `assets/`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Overlay shows installed (old) default assets after reinstall | Bump the extension version and reinstall with `--force`; identical versions may not silently replace. |
| No sound | Reload the window once after install. Check `funk.volume` > 0. `ffplay` (from ffmpeg) on PATH gives the cleanest result on Windows/Linux. |
| No image | Verify the path in `funk.image` is absolute with escaped backslashes in JSON (`C:\\Users\\...`) or use `/` separators. |
| Too many Funks for one failure | Raise `funk.cooldown`. |
| Funk triggers on `grep`/`diff` returning 1 | Set `funk.triggerOnExitCode: false`. |
| Overlay doesn't cover the side bar / title bar | Not possible — VS Code doesn't let extensions draw over those; `funk.coverEditor` covers the whole editor area instead. |

---

## License

[MIT](LICENSE) — © 2026 yasir
