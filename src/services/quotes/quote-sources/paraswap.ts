import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { Chain } from '@types';
import { BigNumber } from 'ethers';
import { GlobalQuoteSourceConfig } from '../types';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './types';
import { addQuoteSlippage, failed } from './utils';

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
    ],
    swapAndTransfer: true,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmVtj4RwZ5MMfKpbfv8qXksb5WYBJsQXkaZXLq7ipvMNW5',
};
type ParaswapSupport = { buyOrders: true; swapAndTransfer: true };
export class ParaswapQuoteSource extends AlwaysValidConfigAndContexSource<ParaswapSupport> {
  getMetadata(): QuoteSourceMetadata<ParaswapSupport> {
    return PARASWAP_METADATA;
  }

  async quote({ components: { fetchService }, request, config }: QuoteParams<ParaswapSupport>): Promise<SourceQuoteResponse> {
    const route = await this.getPrice(fetchService, request);
    const isWrapOrUnwrap = this.isWrapingOrUnwrapingWithWToken(request.chain, route);
    const { data, value } = await this.getQuote(fetchService, { ...request, route, isWrapOrUnwrap }, config);
    const quote = {
      sellAmount: BigNumber.from(route.srcAmount),
      buyAmount: BigNumber.from(route.destAmount),
      estimatedGas: BigNumber.from(route.gasCost),
      allowanceTarget: route.tokenTransferProxy,
      tx: {
        to: route.contractAddress,
        calldata: data,
        value,
      },
    };
    const usedSlippage = isWrapOrUnwrap ? 0 : request.config.slippagePercentage;
    return addQuoteSlippage(quote, request.order.type, usedSlippage);
  }

  private async getPrice(
    fetchService: IFetchService,
    {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { timeout },
      external: { tokenData },
    }: SourceQuoteRequest<ParaswapSupport>
  ) {
    const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
    const { sellToken: sellTokenDataResult, buyToken: buyTokenDataResult } = await tokenData.request();
    let url =
      'https://apiv5.paraswap.io/prices' +
      `?network=${chain.chainId}` +
      `&srcToken=${sellToken}` +
      `&destToken=${buyToken}` +
      `&amount=${amount}` +
      `&side=${order.type.toUpperCase()}` +
      `&srcDecimals=${sellTokenDataResult.decimals}` +
      `&destDecimals=${buyTokenDataResult.decimals}`;

    if (!!recipient && takeFrom !== recipient) {
      // If is swap and transfer, then I need to whitelist methods
      url += '&includeContractMethods=simpleSwap,multiSwap,megaSwap';
    }

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(PARASWAP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { priceRoute } = await response.json();
    return priceRoute;
  }

  private async getQuote(
    fetchService: IFetchService,
    {
      chain,
      sellToken,
      buyToken,
      order,
      route,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, txValidFor, timeout },
      isWrapOrUnwrap,
      external: { tokenData },
    }: SourceQuoteRequest<ParaswapSupport> & { route: any; isWrapOrUnwrap: boolean },
    config: GlobalQuoteSourceConfig
  ) {
    const { sellToken: sellTokenDataResult, buyToken: buyTokenDataResult } = await tokenData.request();
    const url = `https://apiv5.paraswap.io/transactions/${chain.chainId}?ignoreChecks=true`;
    const receiver = !!recipient && takeFrom !== recipient ? recipient : undefined;
    let body: any = {
      srcToken: sellToken,
      srcDecimals: sellTokenDataResult.decimals,
      destToken: buyToken,
      destDecimals: buyTokenDataResult.decimals,
      priceRoute: route,
      userAddress: takeFrom,
      receiver,
      partner: config.referrer?.name,
      partnerAddress: config.referrer?.address,
      partnerFeeBps: 0,
      deadline: calculateDeadline(txValidFor),
    };
    if (isWrapOrUnwrap) {
      const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
      body = { ...body, srcAmount: amount.toString(), destAmount: amount.toString() };
    } else if (order.type === 'sell') {
      body = { ...body, srcAmount: order.sellAmount.toString(), slippage: slippagePercentage * 100 };
    } else {
      body = { ...body, destAmount: order.buyAmount.toString(), slippage: slippagePercentage * 100 };
    }

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
    return { data, value: BigNumber.from(value ?? 0) };
  }

  private isWrapingOrUnwrapingWithWToken(chain: Chain, priceRoute: any) {
    return (
      priceRoute.bestRoute?.[0]?.percent === 100 &&
      priceRoute.bestRoute[0].swaps?.[0]?.swapExchanges?.[0]?.percent === 100 &&
      isSameAddress(chain.wToken, priceRoute.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses?.[0])
    );
  }
}
