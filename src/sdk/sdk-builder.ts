import { buildLogsService, BuildLogsParams } from './builders/logs-builder';
import { BuildFetchParams, buildFetchService } from './builders/fetch-builder';
import { BuildProviderParams, buildProviderService } from './builders/provider-builder';
import { buildGasService, BuildGasParams, CalculateGasValuesFromSourceParams } from './builders/gas-builder';
import { BuildMetadataParams, buildMetadataService, CalculateMetadataFromSourceParams } from './builders/metadata-builder';
import { BuildQuoteParams, buildQuoteService } from './builders/quote-builder';
import { buildBalanceService, BuildBalancesParams } from './builders/balance-builder';
import { buildAllowanceService, BuildAllowanceParams } from './builders/allowance-builder';
import { ISDK } from './types';
import { BuildPriceParams, buildPriceService } from './builders/price-builder';
import { buildPermit2Service } from './builders/permit2-builder';
import { BuildDCAParams, buildDCAService } from './builders/dca-builder';
import { BuildBlocksParams, buildBlocksService } from './builders/blocks-builder';
import { buildEarnService } from './builders/earn-builder';

export function buildSDK<Params extends BuildParams = {}>(
  params?: Params
): ISDK<CalculateMetadataFromSourceParams<Params['metadata']>, CalculateGasValuesFromSourceParams<Params['gas']>> {
  const logsService = buildLogsService(params?.logs);
  const fetchService = buildFetchService(params?.fetch);
  const providerService = buildProviderService(params?.provider);
  const blocksService = buildBlocksService(params?.blocks, fetchService, providerService);
  const balanceService = buildBalanceService(params?.balances, fetchService, providerService, logsService);
  const allowanceService = buildAllowanceService(params?.allowances, fetchService, providerService);
  const gasService = buildGasService<Params['gas']>(params?.gas, logsService, fetchService, providerService);
  const metadataService = buildMetadataService<Params['metadata']>(params?.metadata, fetchService, providerService);
  const priceService = buildPriceService(params?.price, fetchService);
  const quoteService = buildQuoteService(params?.quotes, providerService, fetchService, gasService as any, metadataService as any, priceService);
  const permit2Service = buildPermit2Service(quoteService, providerService, gasService as any);
  const dcaService = buildDCAService(params?.dca, { providerService, permit2Service, quoteService, fetchService, priceService });
  const earnService = buildEarnService({ permit2Service, quoteService, providerService, allowanceService });

  return {
    providerService,
    fetchService,
    allowanceService,
    balanceService,
    gasService,
    metadataService,
    priceService,
    quoteService,
    logsService,
    permit2Service,
    dcaService,
    earnService,
    blocksService,
  };
}

export type BuildParams = {
  fetch?: BuildFetchParams;
  provider?: BuildProviderParams;
  balances?: BuildBalancesParams;
  allowances?: BuildAllowanceParams;
  gas?: BuildGasParams;
  dca?: BuildDCAParams;
  metadata?: BuildMetadataParams;
  price?: BuildPriceParams;
  quotes?: BuildQuoteParams;
  logs?: BuildLogsParams;
  blocks?: BuildBlocksParams;
};
