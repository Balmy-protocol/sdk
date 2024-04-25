import { ChainId } from '@types';
import { Address } from 'viem';
import * as chains from 'viem/chains';
export const MULTICALL_ADDRESS: Address = '0xcA11bde05977b3631167028862bE2a173976CA11';
export function getViemChain(chainId: ChainId) {
  return Object.values(chains).find((chain) => 'id' in chain && chain.id === chainId);
}
