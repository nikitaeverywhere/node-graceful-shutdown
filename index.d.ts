interface OnShutdown {
  (handler: () => Promise<void>): void;
  (name: string, handler: () => Promise<void>): void;
  (name: string, dependencies: string[], handler: () => Promise<void>): void;
}

export const onShutdown: OnShutdown;

export function onShutdownError(
  callback: (error: Error) => Promise<void>
): void;
