import { TimeString } from '@types';
import ms from 'ms';

export class TimeoutError extends Error {
  constructor(description: string, timeout: TimeString | number) {
    super(`${description} timeouted at ${typeof timeout === 'number' ? `${timeout}ms` : timeout}`);
  }
}

export function timeoutPromise<T>(
  promise: Promise<T>,
  timeout: TimeString | number | undefined,
  options?: { reduceBy?: TimeString; description?: string; onTimeout?: (timeout: TimeString | number) => void }
) {
  if (!timeout) return promise;
  const realTimeout = options?.reduceBy ? reduceTimeout(timeout, options.reduceBy) : timeout;
  const timeoutMs = typeof realTimeout === 'number' ? realTimeout : ms(realTimeout);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      options?.onTimeout?.(realTimeout);
      reject(new TimeoutError(options?.description ?? 'Promise', timeout));
    }, timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export function reduceTimeout<T extends TimeString | number | undefined>(timeout: T, reduceBy: TimeString): T {
  if (!timeout) return undefined as T;
  const millisTimeout = typeof timeout === 'number' ? timeout : ms(timeout);
  const millisToTakeOut = ms(reduceBy);
  return millisTimeout > millisToTakeOut
    ? ((millisTimeout - millisToTakeOut).toString() as T)
    : (Math.floor((millisTimeout * 3) / 4).toString() as T);
}
