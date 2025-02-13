import ms from 'ms';
import crossFetch from 'cross-fetch';
import { Fetch, IFetchService, RequestInit } from './types';
import { TimeoutError } from '@shared/timeouts';
import { wait } from '@shared/wait';

export class FetchService implements IFetchService {
  constructor(private readonly realFetch: Fetch = crossFetch) {}

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const { retries = 3, retryDelay = 1000, retryWithTimeout = true, timeout: timeoutText = '5m', ...restInit } = init ?? {};

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      let timeouted = false;
      const timeoutId = setTimeout(() => {
        timeouted = true;
        controller.abort();
      }, ms(timeoutText));

      try {
        const response = await this.realFetch(url, {
          ...restInit,
          signal: controller.signal as AbortSignal,
        });
        return response;
      } catch (error: any) {
        lastError = error;

        if (timeouted) {
          const timeoutError = new TimeoutError(`Request to ${url}`, timeoutText);
          if (!retryWithTimeout || attempt === retries) {
            throw timeoutError;
          }
          lastError = timeoutError;
        } else if (attempt === retries) {
          throw error;
        }

        // Calculate delay with exponential backoff: delay * 2^attempt
        const backoffDelay = retryDelay * Math.pow(2, attempt);
        await wait(backoffDelay);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError;
  }
}
