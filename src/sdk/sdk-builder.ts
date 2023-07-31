import { buildLogsService, BuildLogsParams } from './builders/logs-builder';
import { BuildFetchParams, buildFetchService } from './builders/fetch-builder';
import { BuildProviderParams, buildProviderService } from './builders/provider-builder';
import { buildGasService, BuildGasParams, CalculateGasValuesFromSourceParams } from './builders/gas-builder';
import { buildMulticallService } from './builders/multicall-builder';
import { BuildMetadataParams, buildMetadataService, CalculateMetadataFromSourceParams } from './builders/metadata-builder';
import { BuildQuoteParams, buildQuoteService } from './builders/quote-builder';
import { buildBalanceService, BuildBalancesParams } from './builders/balance-builder';
import { buildAllowanceService, BuildAllowanceParams } from './builders/allowance-builder';
import { ISDK } from './types';
import { BuildPriceParams, buildPriceService } from './builders/price-builder';
import { buildPermit2Service } from './builders/permit2-builder';
import { buildDCAService } from './builders/dca-builder';

export function buildSDK<Params extends BuildParams = {}>(
  params?: Params
): ISDK<CalculateMetadataFromSourceParams<Params['metadata']>, CalculateGasValuesFromSourceParams<Params['gas']>> {
  const logsService = buildLogsService(params?.logs);
  const fetchService = buildFetchService(params?.fetch);
  const providerService = buildProviderService(params?.provider);
  const multicallService = buildMulticallService(providerService);
  const permit2Service = buildPermit2Service(multicallService);
  const balanceService = buildBalanceService(params?.balances, fetchService, providerService, multicallService);
  const allowanceService = buildAllowanceService(params?.allowances, fetchService, multicallService);
  const gasService = buildGasService<Params['gas']>(params?.gas, logsService, fetchService, providerService, multicallService);
  const metadataService = buildMetadataService<Params['metadata']>(params?.metadata, fetchService, multicallService);
  const priceService = buildPriceService(params?.price, fetchService);
  const quoteService = buildQuoteService(params?.quotes, providerService, fetchService, gasService as any, metadataService as any, priceService);
  const dcaService = buildDCAService(multicallService, permit2Service, quoteService);

  return {
    providerService,
    fetchService,
    multicallService,
    allowanceService,
    balanceService,
    gasService,
    metadataService,
    priceService,
    quoteService,
    logsService,
    permit2Service,
    dcaService,
  };
}

export type BuildParams = {
  fetch?: BuildFetchParams;
  provider?: BuildProviderParams;
  balances?: BuildBalancesParams;
  allowances?: BuildAllowanceParams;
  gas?: BuildGasParams;
  metadata?: BuildMetadataParams;
  price?: BuildPriceParams;
  quotes?: BuildQuoteParams;
  logs?: BuildLogsParams;
};
