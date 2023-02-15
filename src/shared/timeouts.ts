import { TimeString } from '@types';
import ms from 'ms';

export function timeoutPromise<T>(
  promise: Promise<T>,
  timeout: TimeString | undefined,
  options?: { reduceBy?: TimeString; description?: string }
) {
  if (!timeout) return promise;
  const realTimeout = options?.reduceBy ? reduceTimeout(timeout, options.reduceBy) : timeout;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const text = `${options?.description ?? 'Promise'} timeouted at ${timeout}`;
      reject(new Error(text));
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
  return millisTimeout > millisToTakeOut ? (ms(millisTimeout - millisToTakeOut) as T) : (ms(Math.floor((millisTimeout * 3) / 4)) as T);
}
