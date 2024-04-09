import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { CacheConfig, ConcurrentLRUCache, ConcurrentLRUCacheWithContext } from '@shared/concurrent-lru-cache';
import { BalanceQueriesSupport, IBalanceSource } from '../types';

type Config = { timeout?: TimeString } | undefined;
export class CachedBalanceSource implements IBalanceSource {
  private readonly cacheHeldByAccount: ConcurrentLRUCacheWithContext<Config, KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>;
  private readonly cacheAmountInChain: ConcurrentLRUCacheWithContext<Config, KeyTokenInChain, AmountOfToken>;

  constructor(private readonly source: IBalanceSource, config: CacheConfig) {
    this.cacheHeldByAccount = new ConcurrentLRUCacheWithContext<Config, KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>({
      calculate: (config, keysHeldByAccount) => this.fetchTokensHeldByAccount(keysHeldByAccount, config),
      config,
    });

    this.cacheAmountInChain = new ConcurrentLRUCacheWithContext<Config, KeyTokenInChain, AmountOfToken>({
      calculate: (config, keysTokenInChain) => this.fetchBalancesForTokens(keysTokenInChain, config),
      config,
    });
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    return this.source.supportedQueries();
  }

  async getTokensHeldByAccounts({
    accounts,
    config,
  }: {
    accounts: Record<ChainId, Address[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const support = this.supportedQueries();
    for (const chainId in accounts) {
      if (!support[chainId]?.getTokensHeldByAccount) {
        return Promise.reject(new Error('Operation not supported'));
      }
    }
    const keys: KeyHeldByAccount[] = Object.entries(accounts).flatMap(([chainId, accounts]) =>
      accounts.map((account) => toKeyHeldByAccount(Number(chainId), account))
    );
    const cacheResults = await this.cacheHeldByAccount.getOrCalculate({
      keys,
      timeout: config?.timeout,
      context: config,
    });
    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    for (const key in cacheResults) {
      const { chainId, account } = fromKeyHeldByAccount(key as KeyTokenInChain);
      if (!(chainId in result)) result[chainId] = {};
      result[chainId][account] = cacheResults[key as KeyTokenInChain];
    }
    return result;
  }

  async getBalancesForTokens({
    tokens,
    config,
  }: {
    tokens: Record<ChainId, Record<Address, TokenAddress[]>>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>>> {
    const allChainAndAccountPairs = Object.entries(tokens).flatMap(([chainId, tokens]) =>
      Object.keys(tokens).map((account) => ({ chainId: Number(chainId), account }))
    );
    const accountsWithHeldByAccount = allChainAndAccountPairs.filter(({ chainId, account }) =>
      this.cacheHeldByAccount.holdsValidValue(toKeyHeldByAccount(chainId, account))
    );
    const accountsWithoutHeldByAccount = allChainAndAccountPairs.filter(
      ({ chainId, account }) => !this.cacheHeldByAccount.holdsValidValue(toKeyHeldByAccount(chainId, account))
    );

    const result: Record<ChainId, Record<Address, Record<TokenAddress, AmountOfToken>>> = {};
    if (accountsWithHeldByAccount.length > 0) {
      // Note: we know these values are cached, so no sense in parallelizing with the query below
      const keys = accountsWithHeldByAccount.map(({ chainId, account }) => toKeyHeldByAccount(chainId, account));
      const tokensHeldByAccount = await this.cacheHeldByAccount.getOrCalculate({ keys, timeout: config?.timeout, context: config });
      for (const key of keys) {
        const { chainId, account } = fromKeyHeldByAccount(key);
        if (!(chainId in result)) result[chainId] = {};
        result[chainId][account] = tokensHeldByAccount[key];
      }
    }

    if (accountsWithoutHeldByAccount.length > 0) {
      const keys = accountsWithoutHeldByAccount.flatMap(({ chainId, account }) =>
        tokens[chainId][account].map((token) => toKeyTokenInChain(chainId, account, token))
      );
      const amountsInChain = await this.cacheAmountInChain.getOrCalculate({
        keys,
        timeout: config?.timeout,
        context: config,
      });
      for (const key in amountsInChain) {
        const { chainId, account, token } = fromKeyTokenInChain(key as KeyTokenInChain);
        if (!(chainId in result)) result[chainId] = {};
        if (!(account in result[chainId])) result[chainId][account] = {};
        result[chainId][account][token] = amountsInChain[key as KeyTokenInChain];
      }
    }

    return result;
  }

  private async fetchTokensHeldByAccount(
    keys: KeyHeldByAccount[],
    config: Config
  ): Promise<Record<KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>> {
    const accounts: Record<ChainId, Address[]> = {};
    for (const key of keys) {
      const { chainId, account } = fromKeyHeldByAccount(key);
      if (!(chainId in accounts)) accounts[chainId] = [];
      accounts[chainId].push(account);
    }

    const balances = await this.source.getTokensHeldByAccounts({ accounts, config });

    const result: Record<KeyHeldByAccount, Record<TokenAddress, AmountOfToken>> = {};
    for (const chainId in balances) {
      for (const account in balances[chainId]) {
        const key = toKeyHeldByAccount(Number(chainId), account);
        result[key] = balances[chainId][account];
      }
    }

    return result;
  }

  private async fetchBalancesForTokens(keys: KeyTokenInChain[], config: Config): Promise<Record<KeyTokenInChain, AmountOfToken>> {
    const tokens: Record<ChainId, Record<Address, TokenAddress[]>> = {};
    for (const key of keys) {
      const { chainId, account, token } = fromKeyTokenInChain(key);
      if (!(chainId in tokens)) tokens[chainId] = {};
      if (!(account in tokens[chainId])) tokens[chainId][account] = [];
      tokens[chainId][account].push(token);
    }

    const balances = await this.source.getBalancesForTokens({ tokens, config });

    const result: Record<KeyTokenInChain, AmountOfToken> = {};
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

type KeyHeldByAccount = `${ChainId}-${Address}`;
type KeyTokenInChain = `${ChainId}-${Address}-${TokenAddress}`;

function toKeyHeldByAccount(chainId: ChainId, account: Address): KeyHeldByAccount {
  return `${chainId}-${account}`;
}

function fromKeyHeldByAccount(key: KeyHeldByAccount): { chainId: ChainId; account: Address } {
  const [chainId, account] = key.split('-');
  return { chainId: Number(chainId), account };
}

function toKeyTokenInChain(chainId: ChainId, account: Address, token: TokenAddress): KeyTokenInChain {
  return `${chainId}-${account}-${token}`;
}

function fromKeyTokenInChain(key: KeyTokenInChain): { chainId: ChainId; account: Address; token: TokenAddress } {
  const [chainId, account, token] = key.split('-');
  return { chainId: Number(chainId), account, token };
}
