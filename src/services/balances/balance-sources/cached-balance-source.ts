import { Address, AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { ContextlessCache, ExpirationConfigOptions } from '@shared/generic-cache';
import { BalanceQueriesSupport, IBalanceSource } from '../types';

export class CachedBalanceSource implements IBalanceSource {
  private readonly cacheHeldByAccount: ContextlessCache<KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>;
  private readonly cacheAmounInChain: ContextlessCache<KeyTokenInChain, AmountOfToken>;

  constructor(private readonly source: IBalanceSource, expirationConfig: ExpirationConfigOptions) {
    this.cacheHeldByAccount = new ContextlessCache<KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>({
      calculate: (keysHeldByAccount) => this.fetchTokensHeldByAccount(keysHeldByAccount),
      toStorableKey: (keyHeldByAccount) => keyHeldByAccount,
      expirationConfig,
    });

    this.cacheAmounInChain = new ContextlessCache<KeyTokenInChain, AmountOfToken>({
      calculate: (keysTokenInChain) => this.fetchBalancesForTokens(keysTokenInChain),
      toStorableKey: (keyTokenInChain) => keyTokenInChain,
      expirationConfig,
    });
  }

  supportedQueries(): Record<ChainId, BalanceQueriesSupport> {
    return this.source.supportedQueries();
  }

  async getTokensHeldByAccount({
    account,
    chains,
    context,
  }: {
    account: Address;
    chains: ChainId[];
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const support = this.supportedQueries();
    for (const chainId of chains) {
      if (!support[chainId]?.getTokensHeldByAccount) {
        return Promise.reject(new Error('Operation not supported'));
      }
    }
    const keys: KeyHeldByAccount[] = chains.map((chainId) => toKeyHeldByAccount(chainId, account));
    const results = await this.cacheHeldByAccount.getOrCalculate({
      keys,
      timeout: context?.timeout,
    });
    const entries: [ChainId, Record<TokenAddress, AmountOfToken>][] = Object.entries(results).map(([key, tokens]) => [
      fromKeyHeldByAccount(key as KeyTokenInChain).chainId,
      tokens,
    ]);
    return Object.fromEntries(entries);
  }

  async getBalancesForTokens({
    account,
    tokens,
    context,
  }: {
    account: Address;
    tokens: Record<ChainId, TokenAddress[]>;
    context?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, AmountOfToken>>> {
    const allChains = Object.keys(tokens).map(Number);
    const chainsWithTokensHeldByAccount = allChains.filter((chainId) =>
      this.cacheHeldByAccount.holdsValidValue(toKeyHeldByAccount(chainId, account))
    );
    const chainsWithoutTokensHeldByAccount = allChains.filter((chainId) => !chainsWithTokensHeldByAccount.includes(chainId));

    const result: Record<ChainId, Record<TokenAddress, AmountOfToken>> = Object.fromEntries(allChains.map((chainId) => [chainId, {}]));
    if (chainsWithTokensHeldByAccount.length > 0) {
      // Note: we know these values are cached, so no sense in parallelizing with the query below
      const tokensHeldByAccount = await this.getTokensHeldByAccount({ account, chains: chainsWithTokensHeldByAccount, context });
      for (const chainId of chainsWithTokensHeldByAccount) {
        const tokenAddresses = tokens[chainId];
        for (const token of tokenAddresses) {
          result[chainId][token] = tokensHeldByAccount[chainId][token] ?? '0';
        }
      }
    }

    if (chainsWithoutTokensHeldByAccount.length > 0) {
      const keys = Object.entries(tokens).flatMap(([chainId, addresses]) =>
        addresses.map((token) => toKeyTokenInChain(Number(chainId), account, token))
      );
      const results = await this.cacheAmounInChain.getOrCalculate({
        keys,
        timeout: context?.timeout,
      });
      for (const key in results) {
        const { chainId, token } = fromKeyTokenInChain(key as KeyTokenInChain);
        result[chainId][token] = results[key as KeyTokenInChain];
      }
    }

    return result;
  }

  private async fetchTokensHeldByAccount(keys: KeyHeldByAccount[]): Promise<Record<KeyHeldByAccount, Record<TokenAddress, AmountOfToken>>> {
    const account = fromKeyHeldByAccount(keys[0]).account;
    const chains = [...new Set(keys.map((key) => fromKeyHeldByAccount(key).chainId))];

    const balances = await this.source.getTokensHeldByAccount({ account, chains });

    const entries = Object.entries(balances).map(([chainId, tokens]) => [toKeyHeldByAccount(Number(chainId), account), tokens]);
    return Object.fromEntries(entries);
  }

  private async fetchBalancesForTokens(keys: KeyTokenInChain[]): Promise<Record<KeyTokenInChain, AmountOfToken>> {
    const account = fromKeyTokenInChain(keys[0]).account;
    const tokens: Record<ChainId, TokenAddress[]> = {};
    for (const key of keys) {
      const { chainId, token } = fromKeyTokenInChain(key);
      if (!(chainId in tokens)) tokens[chainId] = [];
      tokens[chainId].push(token);
    }

    const balances = await this.source.getBalancesForTokens({ account, tokens });

    const result: Record<KeyTokenInChain, AmountOfToken> = {};
    for (const key of keys) {
      const { chainId, token } = fromKeyTokenInChain(key as KeyTokenInChain);
      result[key as KeyTokenInChain] = balances[chainId][token];
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
