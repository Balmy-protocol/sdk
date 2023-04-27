import ms from 'ms';
import { Fetch, IFetchService, RequestInit } from './types';
import { TimeoutError } from '@shared/timeouts';

export class FetchService implements IFetchService {
  constructor(private readonly realFetch: Fetch) {}

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const { timeout: timeoutText, ...otherConfig } = init ?? {};
    // We add a very long timeout if there isn't one, so we can be sure that all requests end at some point
    const timeout = timeoutText ?? '5m';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, ms(timeout));
    try {
      return await this.realFetch(url, { ...otherConfig, signal: controller.signal as AbortSignal });
    } catch (e: any) {
      if (e.message === 'The user aborted a request.') {
        // Trying to throw a better error
        throw new TimeoutError(`Request to ${url}`, timeout);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
