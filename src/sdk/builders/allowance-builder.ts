import { IMulticallService } from '@services/multicall/types';
import { IAllowanceService, IAllowanceSource } from '@services/allowances/types';
import { RPCAllowanceSource } from '@services/allowances/allowance-sources/rpc-allowance-source';
import { AllowanceService } from '@services/allowances/allowance-service';
import { IFetchService } from '@services/fetch';

export type AllowanceSourceInput = { type: 'rpc' } | { type: 'custom'; instance: IAllowanceSource };

export type BuildAllowancesParams = { source: AllowanceSourceInput };

export function buildAllowanceService(
  params: BuildAllowancesParams | undefined,
  fetchService: IFetchService,
  multicallService: IMulticallService
): IAllowanceService {
  const source = buildSource(params?.source, { fetchService, multicallService });
  return new AllowanceService(source);
}

function buildSource(
  source: AllowanceSourceInput | undefined,
  { fetchService, multicallService }: { fetchService: IFetchService; multicallService: IMulticallService }
): IAllowanceSource {
  switch (source?.type) {
    case undefined:
    case 'rpc':
      return new RPCAllowanceSource(multicallService);
    case 'custom':
      return source.instance;
  }
}
