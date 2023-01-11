import { ChainId, Network, TokenAddress } from '@types';
import { BaseToken, ITokenSource } from '@services/tokens/types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';

export class CachedTokenSource<Token extends BaseToken> implements ITokenSource<Token> {
  private readonly cache: ContextlessCache<TokenInNetwork, Token>;

  constructor(private readonly source: ITokenSource<Token>, expirationConfig: ExpirationConfigOptions) {
    this.cache = new ContextlessCache<TokenInNetwork, Token>({
      calculate: (tokensInNetwork) => this.fetchTokens(tokensInNetwork),
      toStorableKey: (tokenInNetwork) => tokenInNetwork,
      expirationConfig,
    });
  }

  supportedNetworks(): Network[] {
    return this.source.supportedNetworks();
  }

  async getTokens(addresses: Record<ChainId, TokenAddress[]>): Promise<Record<ChainId, Record<TokenAddress, Token>>> {
    const tokensInNetwork = addressesToTokensInNetwork(addresses);
    const tokens = await this.cache.getOrCalculate({ keys: tokensInNetwork });
    return tokenInNetworkRecordToChainAndAddress(tokens);
  }

  addedProperties(): Exclude<keyof Token, keyof BaseToken>[] {
    return this.source.addedProperties();
  }

  private async fetchTokens(tokensInNetwork: TokenInNetwork[]): Promise<Record<TokenInNetwork, Token>> {
    const input = tokensInNetworkToAddresses(tokensInNetwork);
    const tokens = await this.source.getTokens(input);
    return chainAndAddressRecordToTokenInNetwork(tokens);
  }
}

function addressesToTokensInNetwork(addresses: Record<ChainId, TokenAddress[]>): TokenInNetwork[] {
  return Object.entries(addresses).flatMap(([chainId, addresses]) => addresses.map((address) => toTokenInNetwork(parseInt(chainId), address)));
}

function tokensInNetworkToAddresses(tokensInNetwork: TokenInNetwork[]): Record<ChainId, TokenAddress[]> {
  const result: Record<ChainId, TokenAddress[]> = {};
  for (const tokenInNetwork of tokensInNetwork) {
    const { chainId, address } = fromTokenInNetwork(tokenInNetwork);
    if (chainId in result) {
      result[chainId].push(address);
    } else {
      result[chainId] = [address];
    }
  }
  return result;
}

function tokenInNetworkRecordToChainAndAddress<Token extends BaseToken>(
  record: Record<TokenInNetwork, Token>
): Record<ChainId, Record<TokenAddress, Token>> {
  const result: Record<ChainId, Record<TokenAddress, Token>> = {};
  for (const [tokenInNetwork, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInNetwork(tokenInNetwork);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInNetwork<Token extends BaseToken>(
  record: Record<ChainId, Record<TokenAddress, Token>>
): Record<TokenInNetwork, Token> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInNetwork, Token]>(([address, token]) => [toTokenInNetwork(parseInt(chainId), address), token])
  );
  return Object.fromEntries(entries);
}

type TokenInNetwork = `${ChainId}-${TokenAddress}`;
function toTokenInNetwork(chainId: ChainId, address: TokenAddress): TokenInNetwork {
  return `${chainId}-${address}`;
}

function fromTokenInNetwork(tokenInNetwork: TokenAddress): { chainId: ChainId; address: TokenAddress } {
  const [chainId, address] = tokenInNetwork.split('-');
  return { chainId: parseInt(chainId), address };
}
