import { IFetchService } from '@services/fetch';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IPriceService, IPriceSource } from '@services/prices';
import { DefiLlamaPriceSource } from '@services/prices/price-sources/defi-llama-price-source';
import { PriceService } from '@services/prices/price-service';
import { CachedPriceSource } from '@services/prices/price-sources/cached-price-source';
import { OdosPriceSource } from '@services/prices/price-sources/odos-price-source';
import { CoingeckoPriceSource } from '@services/prices/price-sources/coingecko-price-source';
import { PortalsFiPriceSource } from '@services/prices/price-sources/portals-fi-price-source';
import { MoralisPriceSource } from '@services/prices/price-sources/moralis-price-source';
import { PrioritizedPriceSource } from '@services/prices/price-sources/prioritized-price-source';
import { FastestPriceSource } from '@services/prices/price-sources/fastest-price-source';
import { AggregatorPriceSource, PriceAggregationMethod } from '@services/prices/price-sources/aggregator-price-source';

export type PriceSourceInput =
  | { type: 'defi-llama' }
  | { type: 'odos' }
  | { type: 'coingecko' }
  | { type: 'portals-fi' }
  | { type: 'moralis'; key: string }
  | { type: 'prioritized'; sources: PriceSourceInput[] }
  | { type: 'fastest'; sources: PriceSourceInput[] }
  | { type: 'aggregate'; sources: PriceSourceInput[]; by: PriceAggregationMethod }
  | { type: 'cached'; underlyingSource: PriceSourceInput; expiration: ExpirationConfigOptions }
  | { type: 'custom'; instance: IPriceSource };
export type BuildPriceParams = { source: PriceSourceInput };

export function buildPriceService(params: BuildPriceParams | undefined, fetchService: IFetchService): IPriceService {
  const source = buildSource(params?.source, { fetchService });
  return new PriceService(source);
}

function buildSource(source: PriceSourceInput | undefined, { fetchService }: { fetchService: IFetchService }): IPriceSource {
  switch (source?.type) {
    case undefined:
    case 'defi-llama':
      return new DefiLlamaPriceSource(fetchService);
    case 'odos':
      return new OdosPriceSource(fetchService);
    case 'portals-fi':
      return new PortalsFiPriceSource(fetchService);
    case 'moralis':
      return new MoralisPriceSource(fetchService, source.key);
    case 'coingecko':
      return new CoingeckoPriceSource(fetchService);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService });
      return new CachedPriceSource(underlying, source.expiration);
    case 'prioritized':
      return new PrioritizedPriceSource(source.sources.map((source) => buildSource(source, { fetchService })));
    case 'fastest':
      return new FastestPriceSource(source.sources.map((source) => buildSource(source, { fetchService })));
    case 'aggregate':
      return new AggregatorPriceSource(
        source.sources.map((source) => buildSource(source, { fetchService })),
        source.by
      );
    case 'custom':
      return source.instance;
  }
}
