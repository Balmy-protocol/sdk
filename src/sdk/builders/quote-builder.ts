import { IFetchService } from '@services/fetch/types';
import { IGasService, DefaultGasValues } from '@services/gas/types';
import { GlobalQuoteSourceConfig, SourceId, SourceMetadata } from '@services/quotes/types';
import { BaseTokenMetadata, IMetadataService } from '@services/metadata/types';
import { LocalSourceList } from '@services/quotes/source-lists/local-source-list';
import { QuoteService } from '@services/quotes/quote-service';
import { SourceConfig } from '@services/quotes/source-registry';
import { IQuoteSourceList } from '@services/quotes/source-lists/types';
import { OverridableSourceList } from '@services/quotes/source-lists/overridable-source-list';
import { ArrayOneOrMore } from '@utility-types';
import { IProviderService } from '@services/providers';
import { IPriceService } from '@services/prices';
import {
  BatchAPISourceList,
  BatchAPISourceListBuildTxRequest,
  BatchAPISourceListQuoteRequest,
  URIGenerator,
} from '@services/quotes/source-lists/batch-api-source-list';

export type QuoteSourceListInput =
  | { type: 'custom'; instance: IQuoteSourceList }
  | { type: 'local' }
  | {
      type: 'batch-api';
      getQuotesURI: URIGenerator<BatchAPISourceListQuoteRequest>;
      buildTxURI: URIGenerator<BatchAPISourceListBuildTxRequest>;
      sources: Record<SourceId, SourceMetadata>;
    }
  | {
      type: 'overridable-source-list';
      lists: {
        default: QuoteSourceListInput;
        getQuotes?: ArrayOneOrMore<{ list: QuoteSourceListInput; sourceIds: SourceId[] }>;
        buildTxs?: ArrayOneOrMore<{ list: QuoteSourceListInput; sourceIds: SourceId[] }>;
      };
    };

export type BuildQuoteParams = { sourceList: QuoteSourceListInput; defaultConfig?: SourceConfig };

export function buildQuoteService(
  params: BuildQuoteParams | undefined,
  providerService: IProviderService,
  fetchService: IFetchService,
  gasService: IGasService<DefaultGasValues>,
  metadataService: IMetadataService<BaseTokenMetadata>,
  priceService: IPriceService
) {
  const sourceList = buildList(params?.sourceList, { providerService, fetchService });
  return new QuoteService({
    priceService,
    gasService,
    metadataService,
    sourceList,
    defaultConfig: {
      global: addReferrerIfNotSet(params?.defaultConfig?.global),
      custom: params?.defaultConfig?.custom,
    },
  });
}

function buildList(
  list: QuoteSourceListInput | undefined,
  {
    providerService,
    fetchService,
  }: {
    providerService: IProviderService;
    fetchService: IFetchService;
  }
): IQuoteSourceList {
  switch (list?.type) {
    case 'custom':
      return list.instance;
    case 'local':
    case undefined:
      return new LocalSourceList({
        providerService,
        fetchService,
      });
    case 'batch-api':
      return new BatchAPISourceList({ fetchService, ...list });
    case 'overridable-source-list':
      const defaultList = buildList(list.lists.default, { providerService, fetchService });
      const getQuotesOverrides = list.lists.getQuotes?.map(({ list, sourceIds }) => ({
        list: buildList(list, { providerService, fetchService }),
        sourceIds,
      }));
      const buildTxsOverrides = list.lists.buildTxs?.map(({ list, sourceIds }) => ({
        list: buildList(list, { providerService, fetchService }),
        sourceIds,
      }));
      return new OverridableSourceList({ default: defaultList, overrides: { getQuotes: getQuotesOverrides, buildTxs: buildTxsOverrides } });
  }
}

// If no referrer address was set, then we will use Balmy's address
function addReferrerIfNotSet(config?: GlobalQuoteSourceConfig) {
  return { referrer: { address: '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01', name: 'balmy' }, ...config };
}
