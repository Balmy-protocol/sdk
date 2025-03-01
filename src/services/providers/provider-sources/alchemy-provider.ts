import { ChainId } from '@types';
import { BaseHttpProvider, HttpProviderConfig } from './base/base-http-provider';
import { ALCHEMY_NETWORKS } from '@shared/alchemy';

export type AlchemySupportedChains = AlchemyDefaultChains | ChainId[];
type AlchemyDefaultChains = { allInTier: 'free tier' | 'paid tier'; except?: ChainId[] };

export class AlchemyProviderSource extends BaseHttpProvider {
  private readonly key: string;
  private readonly supported: ChainId[];

  constructor({ key, onChains, config }: { key: string; onChains?: AlchemySupportedChains; config?: HttpProviderConfig }) {
    super(config);
    this.key = key;
    if (onChains === undefined) {
      this.supported = alchemySupportedChains();
    } else if (Array.isArray(onChains)) {
      this.supported = onChains;
    } else {
      const chains = alchemySupportedChains({ onlyFree: onChains.allInTier === 'free tier' });
      this.supported = onChains.except ? chains.filter((chain) => !onChains.except!.includes(chain)) : chains;
    }
  }

  supportedChains(): ChainId[] {
    return this.supported;
  }

  protected calculateUrl(chainId: ChainId): string {
    return buildAlchemyRPCUrl({ chainId, apiKey: this.key, protocol: 'https' });
  }
}

export function alchemySupportedChains(args?: { onlyFree?: boolean }): ChainId[] {
  return Object.entries(ALCHEMY_NETWORKS)
    .filter(
      ([
        _,
        {
          rpc: { tier },
        },
      ]) => tier === 'free' || !args?.onlyFree
    )
    .map(([chainId]) => Number(chainId));
}

export function buildAlchemyRPCUrl({ chainId, apiKey, protocol }: { chainId: ChainId; apiKey: string; protocol: 'https' | 'wss' }) {
  const { key: alchemyNetwork } = ALCHEMY_NETWORKS[chainId];
  return `${protocol}://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}
