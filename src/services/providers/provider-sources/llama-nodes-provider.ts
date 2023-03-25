import { Chains } from '@chains';
import { ChainId } from '@types';
import { providers } from 'ethers';
import { IProviderSource } from '../types';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'https://eth.llamarpc.com/rpc/',
  [Chains.POLYGON.chainId]: 'https://polygon.llamarpc.com/rpc/',
};

export class LlamaNodesProviderSource implements IProviderSource {
  constructor(private readonly key: string) {}

  supportedChains(): ChainId[] {
    return Object.keys(SUPPORTED_CHAINS).map(parseInt);
  }

  getEthersProvider({ chainId }: { chainId: ChainId }): providers.BaseProvider {
    const rpcUrl = SUPPORTED_CHAINS[chainId];
    if (!rpcUrl) throw new Error(`Unsupported chain with id ${chainId}`);
    return new providers.JsonRpcProvider(rpcUrl + this.key);
  }
}
