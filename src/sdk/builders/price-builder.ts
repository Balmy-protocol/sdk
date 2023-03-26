import { IFetchService } from '@services/fetch';
import { ExpirationConfigOptions } from '@shared/generic-cache';
import { IPriceService, IPriceSource } from '@services/prices';
import { DefiLlamaPriceSource } from '@services/prices/price-sources/defi-llama-price-source';
import { PriceService } from '@services/prices/price-service';
import { CachedPriceSource } from '@services/prices/price-sources/cached-price-source';
import { OdosPriceSource } from '@services/prices/price-sources/odos-price-source';
import { CoingeckoPriceSource } from '@services/prices/price-sources/coingecko-price-source';
import { PortalsFiPriceSource } from '@services/prices/price-sources/portals-fi-price-source';

export type PriceSourceInput =
  | { type: 'defi-llama' }
  | { type: 'odos' }
  | { type: 'coingecko' }
  | { type: 'portals-fi' }
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
    case 'coingecko':
      return new CoingeckoPriceSource(fetchService);
    case 'cached':
      const underlying = buildSource(source.underlyingSource, { fetchService });
      return new CachedPriceSource(underlying, source.expiration);
    case 'custom':
      return source.instance;
  }
}
