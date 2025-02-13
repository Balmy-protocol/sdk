import { TimeString } from '@types';

export type RequestInit = globalThis.RequestInit & {
  timeout?: TimeString;
  retries?: number;
  retryDelay?: number;
  retryWhenTimeouted?: boolean;
};

export type IFetchService = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type Fetch = typeof global.fetch;
