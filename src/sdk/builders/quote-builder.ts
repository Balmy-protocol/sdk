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
  // If no referrer address was set, then we will use Mean's address
  const config = { referrerAddress: '0x1a00e1E311009E56e3b0B9Ed6F86f5Ce128a1C01', ...params?.config } as CustomConfig & GlobalQuoteSourceConfig;
  return new QuoteService<CustomConfig>({
    fetchService,
    gasService,
    tokenService,
    config,
  });
}
