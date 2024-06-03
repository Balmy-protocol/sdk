import ms from 'ms';
import { TimeString } from '@types';

export function wait(time: TimeString | number) {
  return new Promise((resolve) => setTimeout(resolve, ms(`${time}`)));
}

export function waitUntil({ check, every, maxAttempts }: { check: () => Promise<boolean> | boolean; every: TimeString; maxAttempts?: number }) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      let attempts = 0;
      let result = await check();
      while (!result && attempts++ < (maxAttempts ?? Infinity)) {
        await wait(every);
        result = await check();
      }
      if (result) {
        resolve();
      } else {
        reject(new Error(`Check continued to fail after ${maxAttempts} attempts`));
      }
    } catch (e) {
      reject(e);
    }
  });
}
