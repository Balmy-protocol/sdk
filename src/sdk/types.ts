import { IAllowanceService } from '@services/allowances';
import { IBalanceService } from '@services/balances/types';
import { IFetchService } from '@services/fetch/types';
import { IGasService } from '@services/gas/types';
import { IMulticallService } from '@services/multicall/types';
import { IProviderSource } from '@services/providers';
import { IQuoteService } from '@services/quotes/types';
import { ITokenService } from '@services/tokens/types';

export type ISDK<TokenData extends object> = {
  providerSource: IProviderSource;
  fetchService: IFetchService;
  gasService: IGasService;
  multicallService: IMulticallService;
  allowanceService: IAllowanceService;
  balanceService: IBalanceService;
  quoteService: IQuoteService;
  tokenService: ITokenService<TokenData>;
};
