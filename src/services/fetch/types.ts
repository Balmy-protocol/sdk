import { TimeString } from '@types';

export type RequestInit = globalThis.RequestInit & { timeout?: TimeString };
export type IFetchService = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};
export type Fetch = typeof global.fetch;
