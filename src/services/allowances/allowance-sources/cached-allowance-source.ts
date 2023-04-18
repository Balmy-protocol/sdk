import { AmountOfToken, ChainId, TimeString, TokenAddress } from '@types';
import { CacheConfig, ContextlessConcurrentLRUCache } from '@shared/concurrent-lru-cache';
import { AllowanceCheck, IAllowanceSource, OwnerAddress, SpenderAddress } from '../types';

export class CachedAllowanceSource implements IAllowanceSource {
  private readonly cache: ContextlessConcurrentLRUCache<Key, AmountOfToken>;

  constructor(private readonly source: IAllowanceSource, config: CacheConfig) {
    this.cache = new ContextlessConcurrentLRUCache<Key, AmountOfToken>({
      calculate: (ownerSpendersInChain) => this.fetchTokens(ownerSpendersInChain),
      config,
    });
  }

  supportedChains(): ChainId[] {
    return this.source.supportedChains();
  }

  async getAllowances({
    allowances,
    config,
  }: {
    allowances: Record<ChainId, AllowanceCheck[]>;
    config?: { timeout?: TimeString };
  }): Promise<Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>> {
    const keys = allowanceChecksToKeys(allowances);
    const result = await this.cache.getOrCalculate({ keys, timeout: config?.timeout });
    return keyResultsToResult(result);
  }

  private async fetchTokens(keys: Key[]): Promise<Record<Key, AmountOfToken>> {
    const allowances = keysToAllowanceChecks(keys);
    const result = await this.source.getAllowances({ allowances });
    return resultsToKeyResults(result);
  }
}

type Key = `${ChainId}-${TokenAddress}-${OwnerAddress}-${SpenderAddress}`;

function allowanceChecksToKeys(allowances: Record<ChainId, AllowanceCheck[]>): Key[] {
  return Object.entries(allowances).flatMap(([chainId, checks]) =>
    checks.map(({ token, owner, spender }) => toKey(Number(chainId), token, owner, spender))
  );
}

function resultsToKeyResults(result: Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>>) {
  const keyResults: Record<Key, AmountOfToken> = {};
  for (const chainId in result) {
    for (const token in result[chainId]) {
      for (const owner in result[chainId][token]) {
        for (const spender in result[chainId][token][owner]) {
          const key = toKey(Number(chainId), token, owner, spender);
          keyResults[key] = result[chainId][token][owner][spender];
        }
      }
    }
  }
  return keyResults;
}

function keysToAllowanceChecks(keys: Key[]) {
  const result: Record<ChainId, AllowanceCheck[]> = {};
  for (const key of keys) {
    const { chainId, token, owner, spender } = fromKey(key);
    if (!(chainId in result)) result[chainId] = [];
    result[chainId].push({ token, owner, spender });
  }
  return result;
}

function keyResultsToResult(keyResults: Record<Key, AmountOfToken>) {
  const result: Record<ChainId, Record<TokenAddress, Record<OwnerAddress, Record<SpenderAddress, AmountOfToken>>>> = {};
  for (const [key, amount] of Object.entries(keyResults)) {
    const { chainId, token, owner, spender } = fromKey(key as Key);
    if (!(chainId in result)) result[chainId] = {};
    if (!(token in result[chainId])) result[chainId][token] = {};
    if (!(owner in result[chainId][token])) result[chainId][token][owner] = {};
    result[chainId][token][owner][spender] = amount;
  }
  return result;
}

function toKey(chainId: ChainId, token: TokenAddress, owner: OwnerAddress, spender: SpenderAddress): Key {
  return `${chainId}-${token}-${owner}-${spender}`;
}

function fromKey(key: Key): { chainId: ChainId; token: TokenAddress; owner: OwnerAddress; spender: SpenderAddress } {
  const [chainId, token, owner, spender] = key.split('-');
  return { chainId: Number(chainId), token, owner, spender };
}
