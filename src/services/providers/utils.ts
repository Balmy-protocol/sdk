import { ChainId } from '@types';
import * as chains from 'viem/chains';
import { Contract } from '@shared/contracts';
export const MULTICALL_CONTRACT = Contract.with({ defaultAddress: '0xcA11bde05977b3631167028862bE2a173976CA11' }).build();
export function getViemChain(chainId: ChainId): any {
  return Object.values(chains).find((chain) => 'id' in chain && chain.id === chainId);
}
