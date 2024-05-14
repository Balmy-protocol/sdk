import { IFetchService } from '@services/fetch';
import { CacheConfig } from '@shared/concurrent-lru-cache';
import { IPriceService, IPriceSource } from '@services/prices';
import { DefiLlamaPriceSource } from '@services/prices/price-sources/defi-llama-price-source';
import { PriceService } from '@services/prices/price-service';
import { CachedPriceSource } from '@services/prices/price-sources/cached-price-source';
import { OdosPriceSource } from '@services/prices/price-sources/odos-price-source';
import { CoingeckoPriceSource } from '@services/prices/price-sources/coingecko-price-source';
import { PrioritizedPriceSource } from '@services/prices/price-sources/prioritized-price-source';
import { FastestPriceSource } from '@services/prices/price-sources/fastest-price-source';
import { AggregatorPriceSource, PriceAggregationMethod } from '@services/prices/price-sources/aggregator-price-source';
import { BalmyPriceSource } from '@services/prices/price-sources/balmy-price-source';

export type PriceSourceInput =
  | { type: 'defi-llama' }
  | { type: 'odos' }
  | { type: 'coingecko' }
  | { type: 'balmy' }
  | { type: 'prioritized'; sources: PriceSourceInput[] }
  | { type: 'fastest'; sources: PriceSourceInput[] }
  | { type: 'aggregate'; sources: PriceSourceInput[]; by: PriceAggregationMethod }
  | { type: 'cached'; underlyingSource: PriceSourceInput; config: CacheConfig }
  | { type: 'custom'; instance: IPriceSource };
export type BuildPriceParams = { source: PriceSourceInput };

export function buildPriceService(params: BuildPriceParams | undefined, fetchService: IFetchService): IPriceService {
  const source = buildSource(params?.source, { fetchService });
  return new PriceService(source);
}

function buildSource(source: PriceSourceInput | undefined, { fetchService }: { fetchService: IFetchService }): IPriceSource {
  const coingecko = new CoingeckoPriceSource(fetchService);
  const defiLlama = new DefiLlamaPriceSource(fetchService);
  switch (source?.type) {
    case undefined:
      // Defi Llama is basically Coingecko with some token mappings. Defi Llama has a 5 min cache, so the priority will be Coingecko => DefiLlama
      return new PrioritizedPriceSource([coingecko, defiLlama]);
    case 'defi-llama':
      return defiLlama;
    case 'odos':
      return new OdosPriceSource(fetchService);
    case 'balmy':
      return new BalmyPriceSource(fetchService);
    case 'coingecko':
      return coingecko;
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService });
      return new CachedPriceSource(underlying, source.config);
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
