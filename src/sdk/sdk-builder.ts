import { BuildFetchParams, buildFetchService } from './builders/fetch-builder';
import { BuildProviderParams, buildProviderSource } from './builders/provider-source-builder';
import { buildGasService, BuildGasParams, CalculateGasValuesFromSourceParams } from './builders/gas-builder';
import { buildMulticallService } from './builders/multicall-builder';
import { BuildBalancesParams } from './builders';
import { BuildTokenParams, buildTokenService, CalculateTokenFromSourceParams } from './builders/token-builder';
import { BuildQuoteParams, buildQuoteService } from './builders/quote-builder';
import { buildBalanceService } from './builders/balance-builder';
import { buildAllowanceService, BuildAllowancesParams } from './builders/allowance-builder';
import { ISDK } from './types';

export function buildSDK<Params extends BuildParams = {}>(
  params?: Params
): ISDK<CalculateTokenFromSourceParams<Params['tokens']>, CalculateGasValuesFromSourceParams<Params['gas']>> {
  const fetchService = buildFetchService(params?.fetch);
  const providerSource = buildProviderSource(params?.provider);
  const multicallService = buildMulticallService(providerSource);
  const balanceService = buildBalanceService(params?.balances, fetchService, providerSource, multicallService);
  const allowanceService = buildAllowanceService(params?.allowances, fetchService, multicallService);
  const gasService = buildGasService<Params['gas']>(params?.gas, fetchService, providerSource, multicallService);
  const tokenService = buildTokenService<Params['tokens']>(params?.tokens, fetchService, multicallService);
  const quoteService = buildQuoteService(params?.quotes, providerSource, fetchService, gasService as any, tokenService);

  return {
    providerSource,
    fetchService,
    multicallService,
    allowanceService,
    balanceService,
    gasService,
    tokenService,
    quoteService,
  };
}

type BuildParams = {
  fetch?: BuildFetchParams;
  provider?: BuildProviderParams;
  balances?: BuildBalancesParams;
  allowances?: BuildAllowancesParams;
  gas?: BuildGasParams;
  tokens?: BuildTokenParams;
  quotes?: BuildQuoteParams;
};
