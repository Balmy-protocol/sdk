import { IBalanceService } from '@services/balances/types';
import { IFetchService } from '@services/fetch/types';
import { IGasService } from '@services/gas/types';
import { IMulticallService } from '@services/multicall/types';
import { IProviderSource } from '@services/providers';
import { IQuoteService } from '@services/quotes/types';
import { BaseToken, ITokenService } from '@services/tokens/types';

export type ISDK<Token extends BaseToken> = {
  providerSource: IProviderSource;
  fetchService: IFetchService;
  gasService: IGasService;
  multicallService: IMulticallService;
  balanceService: IBalanceService;
  quoteService: IQuoteService;
  tokenService: ITokenService<Token>;
};
