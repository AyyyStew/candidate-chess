const DEBUG = true;

export function debug(namespace: string, ...args: unknown[]): void {
  if (DEBUG) console.log(`[${namespace}]`, ...args);
}
