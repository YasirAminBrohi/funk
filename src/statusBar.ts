import * as vscode from 'vscode';
import type { ConfigurationManager } from './configuration';

export interface StatusBar extends vscode.Disposable {
  update(): void;
  dispose(): void;
}

export function createStatusBar(config: ConfigurationManager): StatusBar {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  item.command = 'funk.toggle';
  item.name = 'Funk';

  const update = (): void => {
    item.text = config.settings.enabled ? '$(music) Funk: ON' : '$(music) Funk: OFF';
    item.tooltip = new vscode.MarkdownString(
      config.settings.enabled
        ? 'Funk is enabled. Click to disable.'
        : 'Funk is disabled. Click to enable.',
    );
    item.backgroundColor = config.settings.enabled
      ? undefined
      : new vscode.ThemeColor('statusBarItem.warningBackground');
    item.show();
  };

  const sub = config.onChange(() => update());
  update();

  return {
    update,
    dispose(): void {
      item.dispose();
      sub.dispose();
    },
  };
}
