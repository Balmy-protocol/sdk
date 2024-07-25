import { TimeString } from '@types';
import ms from 'ms';

export class TimeoutError extends Error {
  constructor(description: string, timeout: TimeString) {
    super(`${description} timeouted at ${timeout}`);
  }
}

export function timeoutPromise<T>(
  promise: Promise<T>,
  timeout: TimeString | undefined,
  options?: { reduceBy?: TimeString; description?: string; onTimeout?: () => void }
) {
  if (!timeout) return promise;
  const realTimeout = options?.reduceBy ? reduceTimeout(timeout, options.reduceBy) : timeout;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      options?.onTimeout?.();
      reject(new TimeoutError(options?.description ?? 'Promise', timeout));
    }, ms(realTimeout));
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export function reduceTimeout<T extends TimeString | undefined>(timeout: T, reduceBy: TimeString): T {
  if (!timeout) return undefined as T;
  const millisTimeout = ms(timeout);
  const millisToTakeOut = ms(reduceBy);
  return millisTimeout > millisToTakeOut
    ? ((millisTimeout - millisToTakeOut).toString() as T)
    : (Math.floor((millisTimeout * 3) / 4).toString() as T);
}
