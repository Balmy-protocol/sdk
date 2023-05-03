import ms from 'ms';
import crossFetch from 'cross-fetch';
import { Fetch, IFetchService, RequestInit } from './types';
import { TimeoutError } from '@shared/timeouts';

export class FetchService implements IFetchService {
  constructor(private readonly realFetch: Fetch = crossFetch) {}

  async fetch(url: RequestInfo | URL, init?: RequestInit) {
    const { timeout: timeoutText, ...otherConfig } = init ?? {};
    // We add a very long timeout if there isn't one, so we can be sure that all requests end at some point
    const timeout = timeoutText ?? '5m';
    const controller = new AbortController();
    let timeouted = false;
    const timeoutId = setTimeout(() => {
      timeouted = true;
      controller.abort();
    }, ms(timeout));
    try {
      return await this.realFetch(url, { ...otherConfig, signal: controller.signal as AbortSignal });
    } catch (e: any) {
      if (timeouted) {
        // Trying to throw a better error
        throw new TimeoutError(`Request to ${url}`, timeout);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
