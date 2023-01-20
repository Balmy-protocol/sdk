import { IFetchService } from '@services/fetch/types';
import { IGasService } from '@services/gas/types';
import { GlobalQuoteSourceConfig } from '@services/quotes/types';
import { ITokenService, BaseToken } from '@services/tokens/types';
import { AllSourcesConfig } from '@services/quotes/sources-list';
import { QuoteService } from '@services/quotes/quote-service';

export type BuildQuoteParams<CustomConfig extends Partial<AllSourcesConfig>> = { config?: GlobalQuoteSourceConfig & CustomConfig };

export function buildQuoteService<CustomConfig extends Partial<AllSourcesConfig>>(
  params: BuildQuoteParams<CustomConfig> | undefined,
  fetchService: IFetchService,
  gasService: IGasService,
  tokenService: ITokenService<BaseToken>
) {
  return new QuoteService<CustomConfig>({
    fetchService,
    gasService,
    tokenService,
    config: params?.config,
  });
}
