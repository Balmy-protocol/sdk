import { ChainId } from '@types';
import { BaseHttpProvider } from './base/base-http-provider';
import { ALCHEMY_NETWORKS } from '@shared/alchemy';

export class AlchemyProviderSource extends BaseHttpProvider {
  private readonly supported: ChainId[];

  constructor(private readonly key: string, onChains?: ChainId[] | 'free tier' | 'paid tier') {
    super();
    if (typeof onChains === 'string') {
      this.supported = alchemySupportedChains({ onlyFree: onChains === 'free tier' });
    } else {
      this.supported = onChains ?? alchemySupportedChains();
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
    .filter(([_, { onlyPaid }]) => !onlyPaid || !args?.onlyFree)
    .map(([chainId]) => Number(chainId));
}

export function buildAlchemyRPCUrl({ chainId, apiKey, protocol }: { chainId: ChainId; apiKey: string; protocol: 'https' | 'wss' }) {
  const { key: alchemyNetwork } = ALCHEMY_NETWORKS[chainId];
  return `${protocol}://${alchemyNetwork}.g.alchemy.com/v2/${apiKey}`;
}
