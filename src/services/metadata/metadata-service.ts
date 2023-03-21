import { timeoutPromise } from '@shared/timeouts';
import { ChainId, TimeString, TokenAddress } from '@types';
import { IMetadataService, IMetadataSource } from './types';

export class MetadataService<TokenMetadata extends object> implements IMetadataService<TokenMetadata> {
  constructor(private readonly metadataSource: IMetadataSource<TokenMetadata>) {}

  supportedChains(): ChainId[] {
    return Object.keys(this.supportedProperties()).map(Number);
  }

  supportedProperties() {
    return this.metadataSource.supportedProperties();
  }

  async getMetadataForChain({
    chainId,
    addresses,
    config,
  }: {
    chainId: ChainId;
    addresses: TokenAddress[];
    config?: { timeout?: TimeString };
  }): Promise<Record<TokenAddress, TokenMetadata>> {
    const byChainId = { [chainId]: addresses };
    const result = await this.getMetadata({ addresses: byChainId, config });
    return result[chainId];
  }

  getMetadata({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenMetadata>>> {
    return timeoutPromise(this.metadataSource.getMetadata({ addresses, config }), config?.timeout);
  }
}
