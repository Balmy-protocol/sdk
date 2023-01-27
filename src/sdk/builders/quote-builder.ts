import { IFetchService } from '@services/fetch/types';
import { IGasService } from '@services/gas/types';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';
import { ITokenService, BaseToken } from '@services/tokens/types';
import { DefaultSourceList } from '@services/quotes/source-lists/default/default-source-list';
import { QuoteService } from '@services/quotes/quote-service';
import { AllSourcesConfig } from '@services/quotes/source-lists/default/source-registry';

type QuoteSourceList = { type: 'default'; withConfig?: GlobalQuoteSourceConfig & Partial<AllSourcesConfig> };

export type BuildQuoteParams = { sourceList?: QuoteSourceList };

export function buildQuoteService(
  params: BuildQuoteParams | undefined,
  fetchService: IFetchService,
  gasService: IGasService,
  tokenService: ITokenService<BaseToken>
) {
  const sourceList = buildList(params?.sourceList, { fetchService, gasService, tokenService });
  return new QuoteService(sourceList);
}

function buildList(
  list: QuoteSourceList | undefined,
  {
    fetchService,
    gasService,
    tokenService,
  }: {
    fetchService: IFetchService;
    gasService: IGasService;
    tokenService: ITokenService<BaseToken>;
  }
) {
  switch (list?.type) {
    case 'default':
    default:
      return new DefaultSourceList({ fetchService, gasService, tokenService, config: addReferrerIfNotSet(list?.withConfig) });
  }
}

// If no referrer address was set, then we will use Mean's address
function addReferrerIfNotSet(config?: GlobalQuoteSourceConfig & Partial<AllSourcesConfig>) {
  return { referrerAddress: '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01', ...config };
}
