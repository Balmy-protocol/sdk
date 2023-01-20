import { Fetch } from '@services/fetch/types';
import { FetchService } from '@services/fetch/fetch-service';
import crossFetch from 'cross-fetch';

export type BuildFetchParams = { fetch?: Fetch };

export function buildFetchService(params?: BuildFetchParams) {
  return new FetchService(params?.fetch ?? crossFetch);
}
