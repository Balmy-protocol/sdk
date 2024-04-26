import { IFetchService } from '@services/fetch';
import { CacheConfig } from '@shared/concurrent-lru-cache';
import { IAllowanceService, IAllowanceSource } from '@services/allowances/types';
import { RPCAllowanceSource } from '@services/allowances/allowance-sources/rpc-allowance-source';
import { AllowanceService } from '@services/allowances/allowance-service';
import { CachedAllowanceSource } from '@services/allowances/allowance-sources/cached-allowance-source';
import { IProviderService } from '@services/providers';

export type AllowanceSourceInput =
  | { type: 'rpc-multicall' }
  | { type: 'cached'; underlyingSource: AllowanceSourceInput; config: CacheConfig }
  | { type: 'custom'; instance: IAllowanceSource };
export type BuildAllowanceParams = { source: AllowanceSourceInput };

export function buildAllowanceService(
  params: BuildAllowanceParams | undefined,
  fetchService: IFetchService,
  providerService: IProviderService
): IAllowanceService {
  const source = buildSource(params?.source, { fetchService, providerService });
  return new AllowanceService(source);
}

function buildSource(
  source: AllowanceSourceInput | undefined,
  { fetchService, providerService }: { fetchService: IFetchService; providerService: IProviderService }
): IAllowanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc-multicall':
      return new RPCAllowanceSource(providerService);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService, providerService });
      return new CachedAllowanceSource(underlying, source.config);
    case 'custom':
      return source.instance;
  }
}
