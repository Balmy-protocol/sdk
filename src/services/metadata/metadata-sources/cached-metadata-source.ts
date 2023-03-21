import { ChainId, TimeString, TokenAddress } from '@types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';
import { IMetadataSource } from '../types';

export class CachedMetadataSource<TokenMetadata extends object> implements IMetadataSource<TokenMetadata> {
  private readonly cache: ContextlessCache<TokenInChain, TokenMetadata>;

  constructor(private readonly source: IMetadataSource<TokenMetadata>, expirationConfig: ExpirationConfigOptions) {
    this.cache = new ContextlessCache<TokenInChain, TokenMetadata>({
      calculate: (tokensInChain) => this.fetchMetadata(tokensInChain),
      expirationConfig,
    });
  }

  async getMetadata({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenMetadata>>> {
    const tokensInChain = addressesToTokensInChain(addresses);
    const tokens = await this.cache.getOrCalculate({ keys: tokensInChain, timeout: config?.timeout });
    return tokenInChainRecordToChainAndAddress(tokens);
  }

  supportedProperties() {
    return this.source.supportedProperties();
  }

  private async fetchMetadata(tokensInChain: TokenInChain[]): Promise<Record<TokenInChain, TokenMetadata>> {
    const addresses = tokensInChainToAddresses(tokensInChain);
    const metadata = await this.source.getMetadata({ addresses });
    return chainAndAddressRecordToTokenInChain(metadata);
  }
}

function addressesToTokensInChain(addresses: Record<ChainId, TokenAddress[]>): TokenInChain[] {
  return Object.entries(addresses).flatMap(([chainId, addresses]) => addresses.map((address) => toTokenInChain(Number(chainId), address)));
}

function tokensInChainToAddresses(tokensInChain: TokenInChain[]): Record<ChainId, TokenAddress[]> {
  const result: Record<ChainId, TokenAddress[]> = {};
  for (const tokenInChain of tokensInChain) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (chainId in result) {
      result[chainId].push(address);
    } else {
      result[chainId] = [address];
    }
  }
  return result;
}

function tokenInChainRecordToChainAndAddress<TokenMetadata>(
  record: Record<TokenInChain, TokenMetadata>
): Record<ChainId, Record<TokenAddress, TokenMetadata>> {
  const result: Record<ChainId, Record<TokenAddress, TokenMetadata>> = {};
  for (const [tokenInChain, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInChain<TokenMetadata>(
  record: Record<ChainId, Record<TokenAddress, TokenMetadata>>
): Record<TokenInChain, TokenMetadata> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInChain, TokenMetadata]>(([address, token]) => [toTokenInChain(Number(chainId), address), token])
  );
  return Object.fromEntries(entries);
}

type TokenInChain = `${ChainId}-${TokenAddress}`;
function toTokenInChain(chainId: ChainId, address: TokenAddress): TokenInChain {
  return `${chainId}-${address}`;
}

function fromTokenInChain(tokenInChain: TokenAddress): { chainId: ChainId; address: TokenAddress } {
  const [chainId, address] = tokenInChain.split('-');
  return { chainId: Number(chainId), address };
}
