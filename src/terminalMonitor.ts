import * as vscode from 'vscode';

export interface ExecutionFailure {
  kind: 'terminal' | 'task';
  /** Short one-line summary of the error, if one was captured. */
  summary: string;
  /** Whether error-like output was observed during execution. */
  hadErrorOutput: boolean;
}

const ERROR_LINE_RE =
  /(?:^|\s)((?:[\w.+-]*Error|Exception|Traceback|panic|Segfault|Segmentation fault)\b)/i;

/**
 * Extracts a short, human-readable error summary from raw process output.
 * Never returns more than one trimmed line (~150 chars).
 */
export function extractErrorSummary(output: string): string | null {
  if (!output) return null;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const match = ERROR_LINE_RE.exec(line);
    if (match) {
      const idx = match.index;
      const trimmed = line.slice(idx, idx + 150).trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }
  return null;
}

export function hadErrorLikeOutput(output: string): boolean {
  return extractErrorSummary(output) !== null;
}

/** Splits a terminal stream chunk into readable text (VS Code uses \r\n or \n). */
export function chunkToText(chunk: string): string {
  return chunk;
}

export interface TerminalMonitor extends vscode.Disposable {
  /** Attaches an output catcher to a terminal whose command just started. */
  handleStart(
    event: vscode.TerminalShellExecutionStartEvent,
  ): void;
  /** Checks the matching end event and produces a failure if applicable. */
  handleEnd(
    event: vscode.TerminalShellExecutionEndEvent,
    settings: Pick<
      { triggerOnExitCode: boolean; detectTerminal: boolean },
      'triggerOnExitCode' | 'detectTerminal'
    >,
  ): ExecutionFailure | undefined;
  /** Reset all captured state (e.g. when a terminal closes). */
  forget(terminal: vscode.Terminal): void;
}

interface CaptureState {
  execution: vscode.TerminalShellExecution;
  output: string;
}

async function consumeOutput(
  active: Map<vscode.Terminal, CaptureState>,
  terminal: vscode.Terminal,
  execution: vscode.TerminalShellExecution,
): Promise<void> {
  const state = active.get(terminal);
  if (!state) return;
  try {
    const stream = execution.read();
    for await (const chunk of stream) {
      const current = active.get(terminal);
      if (!current || current.execution !== execution) return;
      current.output += chunk;
      // Cap captured output to avoid runaway memory for chatty commands.
      if (current.output.length > 64_000) {
        current.output = current.output.slice(-32_000);
      }
    }
  } catch {
    // Stream can be interrupted if the terminal closes mid-command; that is
    // fine, we simply lose the tail of the output.
  }
}

export function createTerminalMonitor(): TerminalMonitor {
  // One capture per terminal: the most recent started command.
  const active = new Map<vscode.Terminal, CaptureState>();

  const closeSub = vscode.window.onDidCloseTerminal((t) => {
    active.delete(t);
  });

  return {
    handleStart(event) {
      active.set(event.terminal, {
        execution: event.execution,
        output: '',
      });
      void consumeOutput(active, event.terminal, event.execution);
    },

    handleEnd(event, settings) {
      if (!settings.detectTerminal) return undefined;
      const state = active.get(event.terminal);
      if (!state || state.execution !== event.execution) return undefined;
      active.delete(event.terminal);

      const exitCode = event.exitCode;
      if (exitCode === undefined) return undefined; // unknown — don't guess
      if (exitCode === 0) return undefined;

      const summary = extractErrorSummary(state.output);
      // Non-zero exit but no error-ish output at all: e.g. `grep`/`diff`/`ls`
      // using exit codes as status. Only trigger on these when the user has
      // not asked us to be conservative.
      if (summary === null && !settings.triggerOnExitCode) return undefined;

      return {
        kind: 'terminal',
        summary: summary ?? `Command exited with code ${exitCode}`,
        hadErrorOutput: summary !== null,
      };
    },

    forget(terminal) {
      active.delete(terminal);
    },

    dispose(): void {
      active.clear();
      closeSub.dispose();
    },
  };
}
