export function onShutdown(
    name: (() => Promise<void>) | string | string[],
    dependencies?: (() => Promise<void>) | string[],
    handler?: () => Promise<void>
): void;

export function onShutdownError(callback: (error: Error) => Promise<void>): void;
