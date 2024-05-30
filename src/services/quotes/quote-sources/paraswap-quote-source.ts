import qs from 'qs';
import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { Chain, TimeString } from '@types';
import { GlobalQuoteSourceConfig } from '../types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse, SourceQuoteTransaction } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';

const PARASWAP_METADATA: QuoteSourceMetadata<ParaswapSupport> = {
  name: 'Paraswap',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.AVALANCHE.chainId,
      Chains.FANTOM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.POLYGON_ZKEVM.chainId,
      Chains.BASE.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmVtj4RwZ5MMfKpbfv8qXksb5WYBJsQXkaZXLq7ipvMNW5',
};
type ParaswapSupport = { buyOrders: true; swapAndTransfer: true };
type ParaswapConfig = { sourceAllowlist?: string[] };
type ParaswapData = { srcDecimals: number; destDecimals: number; route: any; txValidFor: TimeString | undefined };
export class ParaswapQuoteSource extends AlwaysValidConfigAndContextSource<ParaswapSupport, ParaswapConfig, ParaswapData> {
  getMetadata(): QuoteSourceMetadata<ParaswapSupport> {
    return PARASWAP_METADATA;
  }

  async quote({
    components: { fetchService },
    request,
    config,
  }: QuoteParams<ParaswapSupport, ParaswapConfig>): Promise<SourceQuoteResponse<ParaswapData>> {
    const {
      sellToken: { decimals: srcDecimals },
      buyToken: { decimals: destDecimals },
    } = await request.external.tokenData.request();
    const route = await this.getPrice(fetchService, request, config, srcDecimals, destDecimals);
    const isWrapOrUnwrap = this.isWrappingOrUnwrappingWithWToken(request.chain, route);
    const quote = {
      sellAmount: BigInt(route.srcAmount),
      buyAmount: BigInt(route.destAmount),
      estimatedGas: BigInt(route.gasCost),
      allowanceTarget: calculateAllowanceTarget(request.sellToken, route.tokenTransferProxy),
      customData: { srcDecimals, destDecimals, route, txValidFor: request.config.txValidFor },
    };
    const usedSlippage = isWrapOrUnwrap ? 0 : request.config.slippagePercentage;
    return addQuoteSlippage(quote, request.order.type, usedSlippage);
  }

  async buildTx({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      maxSellAmount,
      minBuyAmount,
      accounts: { takeFrom, recipient },
      config: { timeout },
      customData: { srcDecimals, destDecimals, route, txValidFor },
    },
    config,
  }: BuildTxParams<ParaswapConfig, ParaswapData>): Promise<SourceQuoteTransaction> {
    const url = `https://apiv5.paraswap.io/transactions/${chain.chainId}?ignoreChecks=true&ignoreGasEstimate=true`;
    const receiver = takeFrom !== recipient ? recipient : undefined;
    let body: any = {
      srcToken: sellToken,
      srcDecimals,
      srcAmount: `${maxSellAmount}`,
      destAmount: `${minBuyAmount}`,
      destToken: buyToken,
      destDecimals,
      priceRoute: route,
      userAddress: takeFrom,
      receiver,
      partner: config.referrer?.name,
      partnerAddress: config.referrer?.address,
      partnerFeeBps: 0,
      deadline: calculateDeadline(txValidFor),
    };

    const response = await fetchService.fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeout,
    });
    if (!response.ok) {
      failed(PARASWAP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { data, value } = await response.json();
    return { calldata: data, value: BigInt(value ?? 0), to: route.contractAddress };
  }

  private async getPrice(
    fetchService: IFetchService,
    { chain, sellToken, buyToken, order, accounts: { takeFrom, recipient }, config: { timeout } }: SourceQuoteRequest<ParaswapSupport>,
    config: ParaswapConfig & GlobalQuoteSourceConfig,
    srcDecimals: number,
    destDecimals: number
  ) {
    const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
    const queryParams = {
      network: chain.chainId,
      srcToken: sellToken,
      destToken: buyToken,
      amount: amount,
      side: order.type.toUpperCase(),
      partner: config.referrer?.name,
      srcDecimals,
      destDecimals,
      includeDEXS: config.sourceAllowlist,
      // Note: request will fail if we don't add these sources
      excludeDEXS: ['ParaSwapPool', 'ParaSwapLimitOrders'],
      // If is swap and transfer, then I need to whitelist methods
      includeContractMethods: !!recipient && !isSameAddress(takeFrom, recipient) ? ['simpleSwap', 'multiSwap', 'megaSwap'] : undefined,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://apiv5.paraswap.io/prices?${queryString}`;
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(PARASWAP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { priceRoute } = await response.json();
    return priceRoute;
  }

  private isWrappingOrUnwrappingWithWToken(chain: Chain, priceRoute: any) {
    return (
      priceRoute.bestRoute?.[0]?.percent === 100 &&
      priceRoute.bestRoute[0].swaps?.[0]?.swapExchanges?.[0]?.percent === 100 &&
      isSameAddress(chain.wToken, priceRoute.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses?.[0])
    );
  }
}
