import * as vscode from 'vscode';
import { createConfigurationManager } from './configuration';
import { createTerminalMonitor } from './terminalMonitor';
import { createTaskMonitor } from './taskMonitor';
import { createFunkController } from './funkController';
import { createStatusBar } from './statusBar';
import { registerFunkCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  const config = createConfigurationManager(context.extensionUri);
  const controller = createFunkController(config);
  const terminalMonitor = createTerminalMonitor();
  const taskMonitor = createTaskMonitor();
  const statusBar = createStatusBar(config);

  // --- Terminal shell-integration failure detection -------------------------
  const startSub = vscode.window.onDidStartTerminalShellExecution((event) => {
    try {
      terminalMonitor.handleStart(event);
    } catch (err) {
      console.error('Funk: terminal monitor start failed', err);
    }
  });

  const endSub = vscode.window.onDidEndTerminalShellExecution((event) => {
    try {
      const failure = terminalMonitor.handleEnd(event, {
        detectTerminal: config.settings.detectTerminal,
        triggerOnExitCode: config.settings.triggerOnExitCode,
      });
      if (failure) {
        controller.reactToFailure(failure);
      }
    } catch (err) {
      console.error('Funk: terminal monitor end failed', err);
    }
  });

  const terminalCloseSub = vscode.window.onDidCloseTerminal((t) => {
    terminalMonitor.forget(t);
  });

  // --- Task failure detection ------------------------------------------------
  const taskSub = vscode.tasks.onDidEndTaskProcess((event) => {
    try {
      const failure = taskMonitor.handleEnd(
        event,
        config.settings.detectTasks,
      );
      if (failure) {
        controller.reactToFailure(failure);
      }
    } catch (err) {
      console.error('Funk: task monitor failed', err);
    }
  });

  registerFunkCommands(context, config, controller);

  context.subscriptions.push(
    config,
    controller,
    terminalMonitor,
    taskMonitor,
    statusBar,
    startSub,
    endSub,
    terminalCloseSub,
    taskSub,
  );
}

export function deactivate(): void {
  // All disposables are released via context.subscriptions.
}
