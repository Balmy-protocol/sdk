import ms from 'ms';
import { Fetch, IFetchService, RequestInit } from './types';

export class FetchService implements IFetchService {
  constructor(private readonly realFetch: Fetch) {}

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    if (!init?.timeout) {
      // If not timeout was set, then just execute the call
      return this.realFetch(url, init);
    }

    const { timeout: timeoutText, ...otherConfig } = init;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, ms(timeoutText));
    try {
      return await this.realFetch(url, { ...otherConfig, signal: controller.signal as AbortSignal });
    } catch (e: any) {
      if (e.message === 'The user aborted a request.') {
        // Trying to throw a better error
        throw new Error(`Request to ${url} timeouted`);
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
}
