interface OnShutdown {
  (handler: () => void): void
  (name: string, handler: () => void): void
  (name: string, dependencies: readonly string[], handler: () => void): void
  (handler: () => Promise<void>): void;
  (name: string, handler: () => Promise<void>): void;
  (name: string, dependencies: string[], handler: () => Promise<void>): void;
}

export const onShutdown: OnShutdown;

export function onShutdownError(
  callback: (error: Error) => Promise<void>
): void;
