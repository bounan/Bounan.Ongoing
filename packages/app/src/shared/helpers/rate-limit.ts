export function useRateLimit<TArgs, TResult>(
  callback: (args: TArgs) => TResult | Promise<TResult>,
  delayBetweenCallsMs: number,
): (args: TArgs) => Promise<TResult> {
  let lastResultTime = 0;

  return async (args: TArgs): Promise<TResult> => {
    const now = Date.now();
    const timeSinceLastCall = now - lastResultTime;

    if (timeSinceLastCall < delayBetweenCallsMs) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenCallsMs - timeSinceLastCall));
    }

    const result = await callback(args);
    lastResultTime = Date.now();

    return result;
  };
}
