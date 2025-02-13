import ms from 'ms';
import crossFetch from 'cross-fetch';
import { Fetch, IFetchService, RequestInit } from './types';
import { TimeoutError } from '@shared/timeouts';
import { wait } from '@shared/wait';

export class FetchService implements IFetchService {
  constructor(private readonly realFetch: Fetch = crossFetch) {}

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const { retries = 0, retryDelay = 1000, retryWhenTimeouted = true, timeout: timeoutText = '5m', ...restInit } = init ?? {};

    const errors: Error[] = [];

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
        if (timeouted) {
          const timeoutError = new TimeoutError(`Request to ${url}`, timeoutText);
          errors.push(timeoutError);
          if (!retryWhenTimeouted || attempt === retries) {
            throw new AggregateError(errors);
          }
        } else {
          errors.push(error);
          if (attempt === retries) {
            throw new AggregateError(errors);
          }
        }

        // Calculate delay with exponential backoff: delay * 2^attempt
        const backoffDelay = retryDelay * Math.pow(2, attempt + 1);
        await wait(backoffDelay);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new AggregateError(errors, 'Multiple fetch attempts failed');
  }
}
