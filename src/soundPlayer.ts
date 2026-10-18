import { spawn } from 'child_process';
import * as vscode from 'vscode';

export interface SoundPlayer {
  play(soundUri: vscode.Uri, volume: number): Promise<boolean>;
  dispose(): void;
}

/** Live playback processes so a rapid Re-Funk doesn't stack audio. */
const LIVE = new Set<ReturnType<typeof spawn>>();

function whichWindows(cmd: string): boolean {
  try {
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const res = spawnSync('where', [cmd], { shell: false });
    return res.status === 0;
  } catch {
    return false;
  }
}

function whichUnix(cmd: string): boolean {
  try {
    const { spawnSync } = require('child_process') as typeof import('child_process');
    const res = spawnSync('which', [cmd], { shell: false });
    return res.status === 0;
  } catch {
    return false;
  }
}

function runnerFor(cmd: string): 'where' | 'which' {
  return process.platform === 'win32' ? 'where' : 'which';
}

function exists(cmd: string): boolean {
  return runnerFor(cmd) === 'where' ? whichWindows(cmd) : whichUnix(cmd);
}

/**
 * Plays an audio file from the extension host using the best available system
 * player. Returns whether a player actually started (so callers can fall
 * back to webview audio otherwise).
 */
export function playSoundHost(soundUri: vscode.Uri, volume: number): Promise<boolean> {
  const file = soundUri.fsPath;
  const v10 = Math.round(volume * 100); // ffplay uses 0-100
  const vmul = Math.max(0.05, Math.min(1, volume)); // afplay uses a multiplier

  type Cmd = { argv: string[]; check: boolean };
  const candidates: Cmd[] = [];

  if (process.platform === 'win32') {
    if (exists('ffplay')) {
      candidates.push({ argv: ['ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', `-volume`, String(v10), file], check: true });
    }
    // Fallback: Windows Media Player COM (plays MP3/WAV alike).
    candidates.push({
      argv: [
        'powershell', '-NoProfile', '-STA', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command',
        [
          '$p = New-Object -ComObject WMPlayer.OCX;',
          `$p.URL = '${file.replace(/'/g, "''")}';`,
          '$timeout = 10; $i = 0;',
          'while ($p.playState -ne 3 -and $i -lt 100) { Start-Sleep -Milliseconds 50; $i++ };',
          `Start-Sleep -Seconds ${Math.ceil(vmul * 4) || 3};`,
          '$p.close()',
        ].join(' '),
      ],
      check: true,
    });
  } else if (process.platform === 'darwin') {
    candidates.push({ argv: ['afplay', `-volume`, String(mul100(vmul)), file], check: true });
    // afplay -volume takes a *multiplier*, roughly 0-100+; map stat to x(0..2).
  } else {
    if (exists('ffplay')) {
      candidates.push({ argv: ['ffplay', '-nodisp', '-autoexit', '-loglevel', 'quiet', `-volume`, String(v10), file], check: true });
    }
    if (exists('paplay')) {
      candidates.push({ argv: ['paplay', file], check: true });
    }
    if (exists('mpg123')) {
      candidates.push({ argv: ['mpg123', '-q', file], check: true });
    }
  }

  return tryEach(candidates, 0);
}

function mul100(v: number): number {
  return Math.round(Math.max(0.1, v * 2));
}

function tryEach(candidates: { argv: string[]; check: boolean }[], i: number): Promise<boolean> {
  const c = candidates[i];
  if (!c) return Promise.resolve(false);
  return startPlayer(c.argv).then((ok) => {
    if (ok) return true;
    return tryEach(candidates, i + 1);
  });
}

function startPlayer(argv: string[]): Promise<boolean> {
  const [prog, ...rest] = argv;
  if (!prog) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const child = spawn(prog, rest, { stdio: 'ignore', detached: false });
      LIVE.add(child);
      child.once('error', () => {
        LIVE.delete(child);
        resolve(false);
      });
      child.once('exit', () => LIVE.delete(child));
      // If it didn't crash within 400ms we assume it's actually playing.
      setTimeout(() => resolve(child.exitCode === null || child.exitCode === 0), 400);
    } catch {
      resolve(false);
    }
  });
}

export function stopAllSounds(): void {
  for (const child of LIVE) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  LIVE.clear();
}

export function createSoundPlayer(): SoundPlayer {
  return {
    play(soundUri, volume) {
      return playSoundHost(soundUri, volume);
    },
    dispose() {
      stopAllSounds();
    },
  };
}
