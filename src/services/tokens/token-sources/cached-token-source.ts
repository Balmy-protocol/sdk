import { ChainId, TimeString, TokenAddress } from '@types';
import { ITokenSource } from '@services/tokens/types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';

export class CachedTokenSource<TokenData extends object> implements ITokenSource<TokenData> {
  private readonly cache: ContextlessCache<TokenInChain, TokenData>;

  constructor(private readonly source: ITokenSource<TokenData>, expirationConfig: ExpirationConfigOptions) {
    this.cache = new ContextlessCache<TokenInChain, TokenData>({
      calculate: (tokensInChain) => this.fetchTokens(tokensInChain),
      expirationConfig,
    });
  }

  async getTokens({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, TokenData>>> {
    const tokensInChain = addressesToTokensInChain(addresses);
    const tokens = await this.cache.getOrCalculate({ keys: tokensInChain, timeout: config?.timeout });
    return tokenInChainRecordToChainAndAddress(tokens);
  }

  tokenProperties() {
    return this.source.tokenProperties();
  }

  private async fetchTokens(tokensInChain: TokenInChain[]): Promise<Record<TokenInChain, TokenData>> {
    const addresses = tokensInChainToAddresses(tokensInChain);
    const tokens = await this.source.getTokens({ addresses });
    return chainAndAddressRecordToTokenInChain(tokens);
  }
}

function addressesToTokensInChain(addresses: Record<ChainId, TokenAddress[]>): TokenInChain[] {
  return Object.entries(addresses).flatMap(([chainId, addresses]) => addresses.map((address) => toTokenInChain(parseInt(chainId), address)));
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

function tokenInChainRecordToChainAndAddress<TokenData>(
  record: Record<TokenInChain, TokenData>
): Record<ChainId, Record<TokenAddress, TokenData>> {
  const result: Record<ChainId, Record<TokenAddress, TokenData>> = {};
  for (const [tokenInChain, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInChain(tokenInChain);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInChain<TokenData>(
  record: Record<ChainId, Record<TokenAddress, TokenData>>
): Record<TokenInChain, TokenData> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInChain, TokenData]>(([address, token]) => [toTokenInChain(parseInt(chainId), address), token])
  );
  return Object.fromEntries(entries);
}

type TokenInChain = `${ChainId}-${TokenAddress}`;
function toTokenInChain(chainId: ChainId, address: TokenAddress): TokenInChain {
  return `${chainId}-${address}`;
}

function fromTokenInChain(tokenInChain: TokenAddress): { chainId: ChainId; address: TokenAddress } {
  const [chainId, address] = tokenInChain.split('-');
  return { chainId: parseInt(chainId), address };
}
