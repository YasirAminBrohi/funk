import * as vscode from 'vscode';
import type { ConfigurationManager } from './configuration';
import type { ExecutionFailure } from './terminalMonitor';
import { createFunkPanel, type FunkOverlayHandle } from './webview/funkPanel';
import {
  createSoundPlayer,
  stopAllSounds,
} from './soundPlayer';

const IDENTICAL_ERROR_WINDOW_MS = 1500;

export interface FunkController extends vscode.Disposable {
  reactToFailure(failure: ExecutionFailure): void;
  test(): void;
  reloadAssets(): void;
  dispose(): void;
}

/** Owns cooldown, dedupe, and delegates the actual show to the overlay. */
export function createFunkController(config: ConfigurationManager): FunkController {
  let panel: FunkOverlayHandle | undefined;
  let lastTriggeredAt = 0;
  let lastFailure: ExecutionFailure | undefined;
  let lastFailureAt = 0;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const sound = createSoundPlayer();

  const configSub = config.onChange(() => {
    void closePanel();
  });

  function closePanel(): void {
    panel?.dispose();
    panel = undefined;
    if (closeTimer !== undefined) {
      clearTimeout(closeTimer);
      closeTimer = undefined;
    }
  }

  function shouldTrigger(failure: ExecutionFailure): boolean {
    const now = Date.now();

    if (now - lastTriggeredAt < config.settings.cooldown) {
      return false;
    }
    // Suppress repeated identical failures within a short window even when
    // the cooldown is configured to zero.
    if (
      lastFailure !== undefined &&
      failure.summary === lastFailure.summary &&
      now - lastFailureAt < IDENTICAL_ERROR_WINDOW_MS
    ) {
      return false;
    }
    return true;
  }

  function trigger(failure: ExecutionFailure | undefined, manual: boolean): void {
    if (!manual) {
      if (!config.settings.enabled) return;
      if (!failure) return;
      if (!shouldTrigger(failure)) return;
      lastTriggeredAt = Date.now();
      lastFailure = failure;
      lastFailureAt = Date.now();
    }

    const settings = config.settings;
    closePanel();

    const summary = settings.showTerminalErrors ? failure?.summary : undefined;

    // Play the sound host-side: extension-host audio is not subject to the
    // webview autoplay policy, so this is the reliable path.
    if (settings.mode !== 'image-only') {
      void sound
        .play(config.resolveAssetUri(settings.sound, 'funk.mp3'), settings.volume)
        .then(() => undefined);
    }

    if (settings.mode === 'sound-only') {
      closeTimer = setTimeout(closePanel, settings.duration);
      return;
    }

    void createFunkPanel(config, summary, {
      timeout: settings.duration,
      coverEditor: true,
    }).then((p) => {
      panel = p;
    });

    closeTimer = setTimeout(closePanel, settings.duration);
  }

  return {
    reactToFailure(failure: ExecutionFailure): void {
      trigger(failure, false);
    },
    test(): void {
      trigger(undefined, true);
    },
    reloadAssets(): void {
      stopAllSounds();
      closePanel();
      void vscode.window.showInformationMessage(
        'Funk: assets reloaded. Your custom image/sound will be used on the next reaction.',
      );
    },
    dispose(): void {
      sound.dispose();
      closePanel();
      configSub.dispose();
    },
  };
}
