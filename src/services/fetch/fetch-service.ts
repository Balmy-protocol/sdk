import ms from "ms";
import { IFetchService, RequestInit } from "./types";

export class FetchService implements IFetchService {

  constructor(private readonly realFetch: typeof global.fetch) { }

  fetch(url: RequestInfo | URL, init?: RequestInit) {
    if (!init?.timeout) {
      // If not timeout was set, then just execute the call
      return this.realFetch(url, init)
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort()
    }, ms(init.timeout));
    try {
      return this.realFetch(url, { ...init, signal: controller.signal as AbortSignal })
    } finally {
      clearTimeout(timeout);
    }
  }

}
