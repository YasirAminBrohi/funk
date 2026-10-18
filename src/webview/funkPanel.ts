import * as vscode from 'vscode';
import type { ConfigurationManager } from '../configuration';
import { funkHtml } from './funkHtml';

export interface FunkOverlayHandle extends vscode.Disposable {
  dispose(): void;
}

/**
 * Shows a short-lived webview overlay over the editor area.
 *
 * VS Code does not allow extensions to float UI above the whole workbench, so
 * the closest faithful behavior is: reveal the webview in the user's *active*
 * editor column (covering the code view), optionally maximize that editor
 * group for the spectacle, then restore the layout when the overlay closes.
 */
export async function createFunkPanel(
  config: ConfigurationManager,
  summary?: string,
  opts?: { timeout: number; coverEditor: boolean },
): Promise<FunkOverlayHandle> {
  const settings = config.settings;
  const extensionRoot = config.extensionRootUri;

  const resourceRoots = [
    vscode.Uri.joinPath(extensionRoot, 'assets'),
    vscode.Uri.joinPath(
      config.resolveAssetUri(settings.image, 'funk.png').with({ scheme: 'file' }),
      '..',
    ),
    vscode.Uri.joinPath(
      config.resolveAssetUri(settings.sound, 'funk.mp3').with({ scheme: 'file' }),
      '..',
    ),
  ];

  const nonce = Math.random().toString(36).slice(2, 14);
  const column =
    vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

  const panel = vscode.window.createWebviewPanel(
    'funk',
    'Funk',
    { viewColumn: column, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: resourceRoots,
    },
  );

  // Best-effort: fill the whole editor area so the overlay feels like a popup.
  let maximized = false;
  if (opts?.coverEditor) {
    try {
      await vscode.commands.executeCommand('workbench.action.maximizeEditor');
      maximized = true;
    } catch {
      // Command unavailable in this VS Code version; overlay still shows.
    }
  }

  panel.webview.html = funkHtml(
    {
      imageUri: webviewAsset(config, 'image', 'funk.png', panel.webview),
      soundUri: webviewAsset(config, 'sound', 'funk.mp3', panel.webview),
      cspSource: panel.webview.cspSource,
      durationMs: settings.duration,
      volume: settings.volume,
      animation: settings.animation,
      summary,
      nonce,
      showImage: settings.mode !== 'sound-only',
      playAudio: settings.mode !== 'image-only',
    },
  );
  void panel.webview.postMessage({ type: 'funk:play' });
  const kickTimer = setTimeout(
    () => void panel.webview.postMessage({ type: 'funk:play' }),
    200,
  );

  return {
    dispose: () => {
      clearTimeout(kickTimer);
      if (maximized) {
        // maximizeEditor is one-way; restoring uses evenEditorWidths.
        void vscode.commands.executeCommand('workbench.action.evenEditorWidths');
      }
      panel.dispose();
    },
  };
}

function webviewAsset(
  config: ConfigurationManager,
  setting: 'image' | 'sound',
  fallback: string,
  webview: vscode.Webview,
): string {
  return webview
    .asWebviewUri(
      config.resolveAssetUri(
        setting === 'image' ? config.settings.image : config.settings.sound,
        fallback,
      ),
    )
    .toString();
}
