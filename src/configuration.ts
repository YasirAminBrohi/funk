import * as vscode from 'vscode';

export type FunkAnimation =
  | 'shake'
  | 'bounce'
  | 'spin'
  | 'zoom'
  | 'shake-bounce'
  | 'chaos';

export type FunkMode = 'image-and-sound' | 'image-only' | 'sound-only';

export interface FunkSettings {
  enabled: boolean;
  mode: FunkMode;
  image: string;
  sound: string;
  duration: number;
  volume: number;
  animation: FunkAnimation;
  showTerminalErrors: boolean;
  cooldown: number;
  detectTasks: boolean;
  detectTerminal: boolean;
  triggerOnExitCode: boolean;
}

const ANIMATIONS: readonly FunkAnimation[] = [
  'shake',
  'bounce',
  'spin',
  'zoom',
  'shake-bounce',
  'chaos',
];

const MODES: readonly FunkMode[] = ['image-and-sound', 'image-only', 'sound-only'];

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function readSettings(): FunkSettings {
  const c = vscode.workspace.getConfiguration('funk');
  const rawAnimation = c.get<string>('animation', 'shake-bounce');
  const animation: FunkAnimation = (ANIMATIONS as readonly string[]).includes(
    rawAnimation,
  )
    ? (rawAnimation as FunkAnimation)
    : 'shake-bounce';
  const rawMode = c.get<string>('mode', 'image-and-sound');
  const mode: FunkMode = (MODES as readonly string[]).includes(rawMode)
    ? (rawMode as FunkMode)
    : 'image-and-sound';

  return {
    enabled: c.get<boolean>('enabled', true),
    mode,
    image: c.get<string>('image', ''),
    sound: c.get<string>('sound', ''),
    duration: clamp(c.get<number>('duration', 3000), 500, 30000),
    volume: clamp(c.get<number>('volume', 1), 0, 1),
    animation,
    showTerminalErrors: c.get<boolean>('showTerminalErrors', true),
    cooldown: clamp(c.get<number>('cooldown', 4000), 0, 60000),
    detectTasks: c.get<boolean>('detectTasks', true),
    detectTerminal: c.get<boolean>('detectTerminal', true),
    triggerOnExitCode: c.get<boolean>('triggerOnExitCode', true),
  };
}

export interface ConfigurationManager extends vscode.Disposable {
  readonly settings: FunkSettings;
  readonly extensionRootUri: vscode.Uri;
  /** Resolve a user-provided asset path to a file URI, falling back to a bundled default. */
  resolveAssetUri(userValue: string, defaultFilename: string): vscode.Uri;
  onChange(fn: (settings: FunkSettings) => void): vscode.Disposable;
}

function isAbsolute(userValue: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(userValue)) return true; // Windows C:\...
  return userValue.startsWith('/') || userValue.startsWith('\\\\'); // POSIX / UNC
}

export function createConfigurationManager(
  extensionRootUri: vscode.Uri,
): ConfigurationManager {
  const listeners = new Set<(settings: FunkSettings) => void>();
  let current = readSettings();

  const changeSub = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('funk')) {
      current = readSettings();
      for (const l of listeners) l(current);
    }
  });

  return {
    get settings(): FunkSettings {
      return current;
    },
    extensionRootUri,
    resolveAssetUri(userValue: string, defaultFilename: string): vscode.Uri {
      if (!userValue.trim()) {
        return vscode.Uri.joinPath(extensionRootUri, 'assets', defaultFilename);
      }
      if (isAbsolute(userValue)) {
        return vscode.Uri.file(userValue);
      }
      const folders = vscode.workspace.workspaceFolders ?? [];
      for (const folder of folders) {
        return vscode.Uri.joinPath(folder.uri, userValue);
      }
      return vscode.Uri.file(userValue);
    },
    onChange(fn: (settings: FunkSettings) => void): vscode.Disposable {
      listeners.add(fn);
      return {
        dispose(): void {
          listeners.delete(fn);
        },
      };
    },
    dispose(): void {
      listeners.clear();
      changeSub.dispose();
    },
  };
}
