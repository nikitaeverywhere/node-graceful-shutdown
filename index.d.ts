type Handler<returnType = void> = () => Promise<returnType> | returnType;

interface OnShutdown {
  Handler
  (name: string, Handler): void
  (name: string, dependencies: string[], Handler): void
}

export const onShutdown: OnShutdown;

export function onShutdownError(
  callback: (error: Error) => Promise<void>
): void;
