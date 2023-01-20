import { Chains } from '@chains';
import { IFetchService } from '@services/fetch/types';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { Chain } from '@types';
import { BigNumber } from 'ethers';
import {
  NoCustomConfigQuoteSource as NoCustomConfigQuoteSource,
  QuoteComponents,
  QuoteSourceMetadata,
  QuoteType,
  SourceQuoteRequest,
  SourceQuoteResponse,
} from './base';
import { addQuoteSlippage, failed } from './utils';

type ParaswapSupport = { buyOrders: true; swapAndTransfer: true };
export class ParaswapQuoteSource extends NoCustomConfigQuoteSource<ParaswapSupport> {
  getMetadata(): QuoteSourceMetadata<ParaswapSupport> {
    return {
      name: 'Paraswap',
      supports: {
        chains: [Chains.ETHEREUM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.AVALANCHE, Chains.FANTOM, Chains.ARBITRUM, Chains.OPTIMISM],
        swapAndTransfer: true,
        buyOrders: true,
      },
      logoURI: 'ipfs://QmVtj4RwZ5MMfKpbfv8qXksb5WYBJsQXkaZXLq7ipvMNW5',
    };
  }

  async quote({ fetchService }: QuoteComponents, request: SourceQuoteRequest<ParaswapSupport>): Promise<SourceQuoteResponse> {
    const route = await this.getPrice(fetchService, request);
    let quote: Omit<SourceQuoteResponse<QuoteType>, 'minBuyAmount' | 'maxSellAmount' | 'type'> = {
      sellAmount: BigNumber.from(route.srcAmount),
      buyAmount: BigNumber.from(route.destAmount),
      estimatedGas: BigNumber.from(route.gasCost),
      allowanceTarget: route.tokenTransferProxy,
    };
    const isWrapOrUnwrap = this.isWrapingOrUnwrapingWithWToken(request.chain, route);
    const usedSlippage = isWrapOrUnwrap ? 0 : request.config.slippagePercentage;
    if (request.accounts.takeFrom) {
      const { data, value } = await this.buildTx(fetchService, { ...request, route, isWrapOrUnwrap });
      quote = {
        ...quote,
        tx: {
          to: route.contractAddress,
          calldata: data,
          value,
        },
      };
    }
    return addQuoteSlippage(quote, request.order.type, usedSlippage);
  }

  private async getPrice(
    fetchService: IFetchService,
    {
      chain,
      sellToken,
      sellTokenData,
      buyToken,
      buyTokenData,
      order,
      accounts: { takeFrom, recipient },
      config: { timeout },
    }: SourceQuoteRequest<ParaswapSupport>
  ) {
    const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
    let url =
      'https://apiv5.paraswap.io/prices' +
      `?network=${chain.chainId}` +
      `&srcToken=${sellToken}` +
      `&destToken=${buyToken}` +
      `&amount=${amount}` +
      `&side=${order.type.toUpperCase()}` +
      `&srcDecimals=${await sellTokenData.then((data) => data.decimals)}` +
      `&destDecimals=${await buyTokenData.then((data) => data.decimals)}`;

    if (!!recipient && takeFrom !== recipient) {
      // If is swap and transfer, then I need to whitelist methods
      url += '&includeContractMethods=simpleSwap,multiSwap,megaSwap';
    }

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken);
    }
    const { priceRoute } = await response.json();
    return priceRoute;
  }

  private async buildTx(
    fetchService: IFetchService,
    {
      chain,
      sellToken,
      sellTokenData,
      buyToken,
      buyTokenData,
      order,
      route,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, txValidFor, timeout },
      isWrapOrUnwrap,
    }: SourceQuoteRequest<ParaswapSupport> & { route: any; isWrapOrUnwrap: boolean }
  ) {
    const url = `https://apiv5.paraswap.io/transactions/${chain.chainId}?ignoreChecks=true`;
    const receiver = !!recipient && takeFrom !== recipient ? recipient : undefined;
    let body: any = {
      srcToken: sellToken,
      srcDecimals: await sellTokenData.then((data) => data.decimals),
      destToken: buyToken,
      destDecimals: await buyTokenData.then((data) => data.decimals),
      priceRoute: route,
      userAddress: takeFrom,
      receiver,
      partnerAddress: this.globalConfig.referrerAddress,
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
      failed(chain, sellToken, buyToken);
    }
    const { data, value } = await response.json();
    return { data, value };
  }

  private isWrapingOrUnwrapingWithWToken(chain: Chain, priceRoute: any) {
    return (
      priceRoute.bestRoute?.[0]?.percent === 100 &&
      priceRoute.bestRoute[0].swaps?.[0]?.swapExchanges?.[0]?.percent === 100 &&
      isSameAddress(chain.wToken, priceRoute.bestRoute[0].swaps[0].swapExchanges[0].poolAddresses?.[0])
    );
  }
}
