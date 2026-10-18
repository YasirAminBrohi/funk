import * as vscode from 'vscode';
import type { ConfigurationManager } from './configuration';
import type { FunkController } from './funkController';

async function setEnabled(enabled: boolean, config: ConfigurationManager): Promise<void> {
  await vscode.workspace
    .getConfiguration('funk')
    .update('enabled', enabled, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(
    enabled ? 'Funk enabled. 💀' : 'Funk disabled.',
  );
}

export function registerFunkCommands(
  context: vscode.ExtensionContext,
  config: ConfigurationManager,
  controller: FunkController,
): void {
  const register = (
    commandId: string,
    handler: (...args: unknown[]) => unknown,
  ): void => {
    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, handler),
    );
  };

  register('funk.test', () => controller.test());

  register('funk.enable', () => {
    void setEnabled(true, config);
  });

  register('funk.disable', () => {
    void setEnabled(false, config);
  });

  register('funk.toggle', () => {
    void setEnabled(!config.settings.enabled, config);
  });

  register('funk.reloadAssets', () => controller.reloadAssets());
}
