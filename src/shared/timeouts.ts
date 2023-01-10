import { TimeString } from "@types";
import ms from "ms";

export function timeoutPromise<T>(promise: Promise<T>, timeout: TimeString, options?: { description?: string }) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const text = `${options?.description ?? 'Promise'} timeouted at ${timeout}`
      reject(new Error(text));
    }, ms(timeout));
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer))
  })
}