import type { FunkAnimation } from '../configuration';

export interface FunkHtmlOptions {
  imageUri: string;
  soundUri: string;
  cspSource: string;
  durationMs: number;
  volume: number;
  animation: FunkAnimation;
  summary?: string | undefined;
  nonce: string;
  showImage: boolean;
  playAudio: boolean;
}

type AnimationClass = `anim-${FunkAnimation}`;

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) =>
    ch === '&'
      ? '&amp;'
      : ch === '<'
        ? '&lt;'
        : ch === '>'
          ? '&gt;'
          : ch === '"'
            ? '&quot;'
            : '&#39;',
  );

/**
 * Generates the (HTML-escaped) overlay document.
 *
 * Security notes:
 * - Strict CSP: `default-src 'none'`; images/media only from the webview
 *   resource root; scripts restricted to our nonce'd inline block.
 * - The error summary is always HTML-escaped before interpolation.
 */
export function funkHtml(o: FunkHtmlOptions): string {
  const summary = o.summary
    ? `<div class="summary">${escapeHtml(o.summary)}</div>`
    : '';

  const image = o.showImage
    ? `<img class="funk-img anim-${o.animation as AnimationClass}" src="${o.imageUri}" alt="Funk!">`
    : '';
  const audio = o.playAudio
    ? `<audio src="${o.soundUri}" preload="auto"></audio>`
    : '';

  const playScript = o.playAudio
    ? `<script nonce="${o.nonce}">
    (function () {
      var audio = document.querySelector('audio');
      if (!audio) return;
      audio.volume = ${JSON.stringify(o.volume)};
      function play() {
        var p = audio.play();
        if (p && p.catch) { p.catch(function () { /* autoplay policy */ }); }
      }
      window.addEventListener('message', function (e) {
        if (e && e.data && e.data.type === 'funk:play') play();
      });
      audio.addEventListener('canplay', play, { once: true });
    })();
  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; img-src ${o.cspSource}; media-src ${o.cspSource}; script-src 'nonce-${o.nonce}'; font-src 'none';">
<title>Funk</title>
<style>
:root { color-scheme: dark; }
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: rgba(12, 12, 18, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--vscode-font-family, sans-serif);
}

.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  will-change: opacity, transform;
}

img.funk-img {
  max-width: min(60vmin, 480px);
  max-height: min(55vmin, 480px);
  width: auto;
  height: auto;
  filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.55));
  user-select: none;
}

.caption {
  color: var(--vscode-foreground, #fff);
  font-size: clamp(16px, 4vmin, 26px);
  font-weight: 700;
  letter-spacing: 1px;
  text-align: center;
}

.summary {
  color: var(--vscode-editorError-foreground, #f48fb1);
  font-size: clamp(11px, 2.6vmin, 15px);
  font-family: var(--vscode-editor-font-family, monospace);
  max-width: calc(min(90vw, 700px));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- entrance & exit --- */
.stage { animation: fade-stage ${o.durationMs}ms ease-in-out forwards; }

@keyframes fade-stage {
  0%   { opacity: 0; transform: scale(0.9); }
  8%   { opacity: 1; transform: scale(1.02); }
  20%  { opacity: 1; transform: scale(1); }
  85%  { opacity: 1; }
  100% { opacity: 0; transform: scale(0.98); }
}

.anim-shake        { animation-name: a-shake; }
.anim-bounce       { animation-name: a-bounce; }
.anim-spin         { animation-name: a-spin; }
.anim-zoom         { animation-name: a-zoom; }
.anim-shake-bounce { animation-name: a-shake-bounce; }
.anim-chaos        { animation-name: a-chaos; }

img.funk-img {
  animation-duration: 1.8s;
  animation-timing-function: ease-in-out;
  animation-fill-mode: both;
}

@keyframes a-shake {
  0%,100% { transform: translateX(0); }
  10%,30%,50%,70%,90% { transform: translateX(-14px) rotate(-2deg); }
  20%,40%,60%,80%     { transform: translateX(14px) rotate(2deg); }
}

@keyframes a-bounce {
  0%,100%  { transform: translateY(0) scale(1); }
  15%      { transform: translateY(-16%) scale(0.97); }
  30%      { transform: translateY(6%)  scale(1.03); }
  45%      { transform: translateY(-9%) scale(0.99); }
  60%      { transform: translateY(4%)  scale(1.01); }
  75%      { transform: translateY(-2%) scale(1.0); }
}

@keyframes a-spin {
  from { transform: rotate(0) scale(1.02); }
  to   { transform: rotate(360deg) scale(1); }
}

@keyframes a-zoom {
  0%   { transform: scale(0.45); }
  55%  { transform: scale(1.18); }
  75%  { transform: scale(0.96); }
  100% { transform: scale(1.06); }
}

@keyframes a-shake-bounce {
  0%   { transform: translateY(-14%) scale(0.92) rotate(0); }
  20%  { transform: translateY(5%)  scale(1.04) rotate(3deg); }
  35%  { transform: translateY(-8%) scale(0.98) rotate(-4deg); }
  50%  { transform: translateY(3%)  scale(1.02) rotate(2deg); }
  65%  { transform: translateY(-4%) scale(1)    rotate(-2deg); }
  80%  { transform: translateY(1%)  scale(1.01) rotate(1deg); }
  100% { transform: translateY(0)  scale(1.02) rotate(0); }
}

@keyframes a-chaos {
  0%   { transform: rotate(0) scale(0.5) translateY(30%); }
  10%  { transform: rotate(-160deg) scale(1.25) translate(6%, -8%); }
  25%  { transform: rotate(140deg) scale(0.9) translate(-8%, 6%); }
  40%  { transform: rotate(-90deg) scale(1.3) translate(4%, -4%); }
  55%  { transform: rotate(60deg) scale(0.95) translate(-5%, 3%); }
  75%  { transform: rotate(-25deg) scale(1.12) translate(2%, -2%); }
  100% { transform: rotate(0) scale(1.05) translateY(0); }
}
</style>
</head>
<body>
  <div class="stage">
    ${image}
    <div class="caption">💀 CODE FAILED 💀</div>
    ${summary}
  </div>
  ${audio}
  ${playScript}
  </body>
</html>`;
}
