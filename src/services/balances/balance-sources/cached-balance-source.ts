import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { CacheConfig, ConcurrentLRUCacheWithContext } from '@shared/concurrent-lru-cache';
import { BalanceInput, IBalanceSource } from '../types';

type Config = { timeout?: TimeString } | undefined;
export class CachedBalanceSource implements IBalanceSource {
  private readonly cache: ConcurrentLRUCacheWithContext<Config, KeyTokenInChain, bigint>;

  constructor(private readonly source: IBalanceSource, config: CacheConfig) {
    this.cache = new ConcurrentLRUCacheWithContext<Config, KeyTokenInChain, bigint>({
      calculate: (config, keysTokenInChain) => this.fetchBalancesForTokens(keysTokenInChain, config),
      config,
    });
  }

  supportedChains() {
    return this.source.supportedChains();
  }

  async getBalances({
    tokens,
    config,
  }: {
    tokens: BalanceInput[];
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, bigint>>>> {
    const keys = tokens.map(({ chainId, account, token }) => toKeyTokenInChain(chainId, account, token));
    const amountsInChain = await this.cache.getOrCalculate({
      keys,
      timeout: config?.timeout,
      context: config,
    });

    const result: Record<ChainId, Record<Address, Record<TokenAddress, bigint>>> = {};
    for (const key in amountsInChain) {
      const { chainId, account, token } = fromKeyTokenInChain(key as KeyTokenInChain);
      if (!(chainId in result)) result[chainId] = {};
      if (!(account in result[chainId])) result[chainId][account] = {};
      result[chainId][account][token] = amountsInChain[key as KeyTokenInChain];
    }

    return result;
  }

  private async fetchBalancesForTokens(keys: KeyTokenInChain[], config: Config): Promise<Record<KeyTokenInChain, bigint>> {
    const tokens = keys.map((key) => fromKeyTokenInChain(key));
    const balances = await this.source.getBalances({ tokens, config });

    const result: Record<KeyTokenInChain, bigint> = {};
    for (const key of keys) {
      const { chainId, account, token } = fromKeyTokenInChain(key as KeyTokenInChain);
      const balance = balances?.[chainId]?.[account]?.[token];
      if (balance !== undefined) {
        result[key as KeyTokenInChain] = balance;
      }
    }
    return result;
  }
}

type KeyTokenInChain = `${ChainId}-${Address}-${TokenAddress}`;

function toKeyTokenInChain(chainId: ChainId, account: Address, token: TokenAddress): KeyTokenInChain {
  return `${chainId}-${account}-${token}`;
}

function fromKeyTokenInChain(key: KeyTokenInChain): { chainId: ChainId; account: Address; token: TokenAddress } {
  const [chainId, account, token] = key.split('-');
  return { chainId: Number(chainId), account, token };
}
