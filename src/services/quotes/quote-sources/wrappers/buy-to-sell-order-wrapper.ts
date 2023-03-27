import { SourceQuoteRequest, QuoteSourceSupport, QuoteSource, SourceQuoteResponse } from '../base';
import { TriggerablePromise } from '../utils';

type AddedBuyOrderSupport<Support extends QuoteSourceSupport> = Pick<Support, 'swapAndTransfer'> & { buyOrders: true };
export function buyToSellOrderWrapper<
  Support extends QuoteSourceSupport,
  CustomQuoteSourceConfig,
  Source extends QuoteSource<Support, CustomQuoteSourceConfig>
>(source: Source): QuoteSource<AddedBuyOrderSupport<Support>, CustomQuoteSourceConfig> {
  return {
    getCustomConfig: () => source.getCustomConfig(),
    getMetadata: () => {
      const { supports: originalSupport, ...originalMetadata } = source.getMetadata();
      return {
        ...originalMetadata,
        supports: {
          ...originalSupport,
          buyOrders: true,
        },
      };
    },
    quote: (components, request) => {
      if (request.order.type === 'sell') {
        return source.quote(components, request as SourceQuoteRequest<Support>);
      } else {
        return executeBuyOrderAsSellOrder(request, (request) => source.quote(components, request));
      }
    },
  };
}

async function executeBuyOrderAsSellOrder<Support extends QuoteSourceSupport>(
  request: SourceQuoteRequest<AddedBuyOrderSupport<Support>>,
  quote: (request: SourceQuoteRequest<Support>) => Promise<SourceQuoteResponse>
) {
  if (request.order.type === 'sell') {
    throw new Error('We should not be able to get here');
  }
  /*
  The idea here is that we need to buy a certain amount of tokens with our source, but there are a few drawbacks to using a buy order:
  * Not all sources support it
  * We might be left with some unspent tokens and we might not want to
  So the idea is to transform the buy order into a sell order by:
  1. Executing a sell order from `buyToken` to `sellToken`, with the actual `buyAmount` as `sellAmount`
     This would allows us to figure understand how much of `sellToken` is needed to get `buyAmount`
  2. With this new information, create a sell order close to the buy order
  */

  // Try to sell the amount of tokens to 'buy', to get an estimate
  const sellOrder = {
    ...request,
    order: { type: 'sell', sellAmount: request.order.buyAmount },
    sellToken: request.buyToken,
    buyToken: request.sellToken,
    external: {
      gasPrice: request.external.gasPrice,
      tokenData: new TriggerablePromise(() =>
        // We need to reverse the tokens here
        request.external.tokenData.request().then(({ sellToken, buyToken }) => ({ sellToken: buyToken, buyToken: sellToken }))
      ),
    },
  } as SourceQuoteRequest<Support>;
  const testSellQuote = await quote(sellOrder);
  // Note: there is room for improvement here. We could take into account the potential slippage to try to guarantee the buy price, or
  // we could execute a few sell quotes to see which one is closer to the buy amount. We are starting simple
  return quote({ ...request, order: { type: 'sell', sellAmount: testSellQuote.buyAmount } });
}
