type Handler<returnType = void> = () => Promise<returnType> | returnType;

interface OnShutdown {
  (handler: Handler): void;
  (name: string, handler: Handler): void;
  (name: string, dependencies: string[], handler: Handler): void;
}

export const onShutdown: OnShutdown;

export function onShutdownError(
  callback: (error: Error) => Promise<void>
): void;
