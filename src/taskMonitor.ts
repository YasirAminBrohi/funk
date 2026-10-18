import * as vscode from 'vscode';
import type { ExecutionFailure } from './terminalMonitor';

export interface TaskMonitor extends vscode.Disposable {
  handleEnd(
    event: vscode.TaskProcessEndEvent,
    detectTasks: boolean,
  ): ExecutionFailure | undefined;
}

export function createTaskMonitor(): TaskMonitor {
  return {
    handleEnd(event, detectTasks) {
      if (!detectTasks) return undefined;
      const exitCode = event.exitCode;
      if (exitCode === undefined || exitCode === 0) return undefined;
      // Tasks don't stream output through this API; we report the failing task
      // and its exit code. The Problems panel carries the details.
      return {
        kind: 'task',
        summary: `Task "${event.execution.task.name}" failed with exit code ${exitCode}`,
        hadErrorOutput: false,
      };
    },
    dispose(): void {
      // No listeners of its own; extension.ts wires the event subscription.
    },
  };
}
