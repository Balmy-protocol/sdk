import { IProviderService } from '@services/providers/types';
import { MulticallService } from '@services/multicall/multicall-service';

export type BuildMulticallParams = { library: 'ethers' | 'viem' };
export function buildMulticallService(params: BuildMulticallParams | undefined, providerService: IProviderService) {
  return new MulticallService(providerService, params?.library ?? 'ethers');
}
