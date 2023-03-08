import { IFetchService } from '@services/fetch/types';
import { IGasService } from '@services/gas/types';
import { GlobalQuoteSourceConfig, SourceId, SourceMetadata } from '@services/quotes/types';
import { ITokenService } from '@services/tokens/types';
import { DefaultSourceList } from '@services/quotes/source-lists/default-source-list';
import { QuoteService } from '@services/quotes/quote-service';
import { DefaultSourcesConfig } from '@services/quotes/source-registry';
import { IQuoteSourceList } from '@services/quotes/source-lists/types';
import { OverridableSourceList } from '@services/quotes/source-lists/overridable-source-list';
import { ArrayOneOrMore } from '@utility-types';
import { APISourceList, URIGenerator } from '@services/quotes/source-lists/api-source-list';
import { IProviderSource } from '@services/providers';

export type DefaultSourcesConfigInput = GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig>;
export type QuoteSourceListInput =
  | { type: 'custom'; instance: IQuoteSourceList }
  | { type: 'default'; withConfig?: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig> }
  | { type: 'api'; baseUri: URIGenerator; sources: Record<SourceId, SourceMetadata> }
  | {
      type: 'overridable-source-list';
      lists: { default: QuoteSourceListInput; overrides: ArrayOneOrMore<{ list: QuoteSourceListInput; sourceIds: SourceId[] }> };
    };

export type BuildQuoteParams = { sourceList?: QuoteSourceListInput };

export function buildQuoteService(
  params: BuildQuoteParams | undefined,
  providerSource: IProviderSource,
  fetchService: IFetchService,
  gasService: IGasService<any>,
  tokenService: ITokenService<any>
) {
  const sourceList = buildList(params?.sourceList, { providerSource, fetchService, gasService, tokenService });
  return new QuoteService(sourceList);
}

function buildList(
  list: QuoteSourceListInput | undefined,
  {
    providerSource,
    fetchService,
    gasService,
    tokenService,
  }: {
    providerSource: IProviderSource;
    fetchService: IFetchService;
    gasService: IGasService<any>;
    tokenService: ITokenService<any>;
  }
): IQuoteSourceList {
  switch (list?.type) {
    case 'custom':
      return list.instance;
    case 'default':
    case undefined:
      return new DefaultSourceList({ providerSource, fetchService, gasService, tokenService, config: addReferrerIfNotSet(list?.withConfig) });
    case 'api':
      return new APISourceList({ fetchService, ...list });
    case 'overridable-source-list':
      const defaultList = buildList(list.lists.default, { providerSource, fetchService, gasService, tokenService });
      const overrides = list.lists.overrides.map(({ list, sourceIds }) => ({
        list: buildList(list, { providerSource, fetchService, gasService, tokenService }),
        sourceIds,
      }));
      return new OverridableSourceList({ default: defaultList, overrides });
  }
}

// If no referrer address was set, then we will use Mean's address
function addReferrerIfNotSet(config?: GlobalQuoteSourceConfig & Partial<DefaultSourcesConfig>) {
  return { referrer: { address: '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01', name: 'MeanFinance' }, ...config };
}
