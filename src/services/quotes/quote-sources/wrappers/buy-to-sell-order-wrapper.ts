import { SourceQuoteRequest, SellOrder, QuoteSourceSupport, BuyOrder, QuoteSource, QuoteComponents } from '../base';

type AddedBuyOrderSupport<Support extends QuoteSourceSupport> = Pick<Support, 'swapAndTransfer'> & { buyOrders: true };
type SellOrderQuote<Support extends QuoteSourceSupport> = SourceQuoteRequest<Support, SellOrder>;
export function buyToSellOrderWrapper<Support extends QuoteSourceSupport, CustomConfigNeeded extends boolean, CustomQuoteSourceConfig>(
  source: QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig>
): QuoteSource<AddedBuyOrderSupport<Support>, CustomConfigNeeded, CustomQuoteSourceConfig> {
  return {
    ...source,
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
        return executeBuyOrderAsSellOrder(source, components, request as SourceQuoteRequest<AddedBuyOrderSupport<Support>, BuyOrder>);
      }
    },
  };
}

async function executeBuyOrderAsSellOrder<Support extends QuoteSourceSupport, CustomConfigNeeded extends boolean, CustomQuoteSourceConfig>(
  source: QuoteSource<Support, CustomConfigNeeded, CustomQuoteSourceConfig>,
  components: QuoteComponents,
  request: SourceQuoteRequest<AddedBuyOrderSupport<Support>, BuyOrder>
) {
  /*
  The idea here is that we need to buy a certain amount of tokens with our source, but there are a few drawbacks to using a buy order:
  * Not all sources support it
  * We might be left with some unspent tokens and we might not want to
  So the idea is to transform the buy order into a sell order by:
  1. Executing a sell order from `buyToken` to `sellToken`, with the actual `buyAmount` as `sellAmount`
     This would allows us to figure understand how much of `sellToken` is needed to get `buyAmount`
  2. If this quote response says that there is no slippage, then we assume that there will be no slippage when executing the actual sell order
  3. If there was some slippage, then we will asume that the test quote's `buyAmount` + slippage will be enough to get the actual `buyAmount`
  */

  // Try to sell the amount of tokens to 'buy', to get an estimate
  const sellOrder = {
    ...request,
    order: { type: 'sell', sellAmount: request.order.buyAmount },
    sellToken: request.buyToken,
    buyToken: request.sellToken,
  } as SellOrderQuote<Support>;
  const testSellQuote = await source.quote(components, sellOrder);
  const slippage = testSellQuote.buyAmount.sub(testSellQuote.minBuyAmount);
  if (slippage.isZero()) {
    // If there was no slippage, then we just execute the sell order
    return source.quote(components, { ...request, order: { type: 'sell', sellAmount: testSellQuote.sellAmount } } as SellOrderQuote<Support>);
  }

  // TODO: there is room for improvement, since we can make a few test quotes around this approx number and find the closest sell quote that produces the actual `buyAmount`
  const sellAmount = testSellQuote.buyAmount.add(slippage);
  return source.quote(components, { ...request, order: { type: 'sell', sellAmount: sellAmount } } as SellOrderQuote<Support>);
}
