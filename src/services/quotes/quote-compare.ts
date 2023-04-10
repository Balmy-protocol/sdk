import { isSameAddress, ruleOfThree } from '@shared/utils';
import { BigNumber } from 'ethers';
import { QuoteResponse } from './types';
import { TokenAddress } from '@types';

export const COMPARE_BY = [
  // Compare spent gas and prioritize the ones with the least spent gas
  'least-gas',
  // Compare rates in terms of input vs output and prioritize the ones with the better rate
  'most-swapped',
  // Compare input vs output but take gas into account. So if a quote has a better rate but it's far more
  // expensive in terms of gas, then it won't be prioritized. This compare method needs the usd price of the tokens
  // to be available. If it isn't, it will default to 'most-swapped'
  'most-swapped-accounting-for-gas',
] as const;

export const COMPARE_USING = ['sell/buy amounts', 'max sell/min buy amounts'] as const;

export type CompareQuotesBy = (typeof COMPARE_BY)[number];
export type CompareQuotesUsing = (typeof COMPARE_USING)[number];
export type ComparableQuote = Pick<
  QuoteResponse,
  'sellToken' | 'buyToken' | 'sellAmount' | 'maxSellAmount' | 'buyAmount' | 'minBuyAmount' | 'gas'
>;

export function sortQuotesBy<T extends ComparableQuote>(quotes: T[], sortBy: CompareQuotesBy, using: CompareQuotesUsing): T[] {
  const compareFtn = getCompareFtn(sortBy);
  return quotes.sort((q1, q2) => compareFtn(q1, q2, using));
}

export function chooseQuotesBy<T extends ComparableQuote>(quotes: T[], sortBy: CompareQuotesBy, using: CompareQuotesUsing): T {
  if (quotes.length === 0) throw new Error(`There are no quotes to choose from`);
  const compareFtn = getCompareFtn(sortBy);
  return quotes.reduce((q1, q2) => (compareFtn(q1, q2, using) <= 0 ? q1 : q2));
}

export function compareQuotesBy(
  sortBy: CompareQuotesBy,
  using: CompareQuotesUsing
): (quote1: ComparableQuote, quote2: ComparableQuote) => number {
  const compareFtn = getCompareFtn(sortBy);
  return (quote1: ComparableQuote, quote2: ComparableQuote) => compareFtn(quote1, quote2, using);
}

function getCompareFtn(compareBy: CompareQuotesBy) {
  let prioritizedCompareFns: Compare[];
  switch (compareBy) {
    case 'most-swapped-accounting-for-gas':
      prioritizedCompareFns = [compareMostProfit, compareByMostSwapped, compareLeastGas];
      break;
    case 'most-swapped':
      prioritizedCompareFns = [compareByMostSwapped, compareLeastGas];
      break;
    case 'least-gas':
      prioritizedCompareFns = [compareLeastGas, compareMostProfit, compareByMostSwapped];
      break;
  }
  return mergeCompareFtns(prioritizedCompareFns);
}

function amountExtractor(using: CompareQuotesUsing) {
  return using === 'sell/buy amounts'
    ? ({ sellAmount, buyAmount }: ComparableQuote) => ({ sellAmount, buyAmount })
    : ({ maxSellAmount, minBuyAmount }: ComparableQuote) => ({ sellAmount: maxSellAmount, buyAmount: minBuyAmount });
}

type Compare = (quote1: ComparableQuote, quote2: ComparableQuote, using: CompareQuotesUsing) => number;

function mergeCompareFtns(prioritizedCompareFns: Compare[]): Compare {
  return (quote1: ComparableQuote, quote2: ComparableQuote, using: CompareQuotesUsing) =>
    prioritizedCompareFns.reduce((accumCompareValue, compare) => accumCompareValue || compare(quote1, quote2, using), 0);
}

function compareMostProfit(quote1: ComparableQuote, quote2: ComparableQuote, using: CompareQuotesUsing) {
  const [profit1, profit2] = [calculateProfit(quote1, using), calculateProfit(quote2, using)];
  if (!profit1 || !profit2 || profit1 === profit2) {
    return 0;
  }
  return profit1 > profit2 ? -1 : 1;
}

function compareByMostSwapped(quote1: ComparableQuote, quote2: ComparableQuote, using: CompareQuotesUsing) {
  if (!isSameAddress(quote1.sellToken.address, quote2.sellToken.address) || !isSameAddress(quote1.buyToken.address, quote2.buyToken.address)) {
    // If we are compating for different pairs, then we'll check profit without gas
    const [profit1, profit2] = [calculateProfitWithoutGas(quote1, using), calculateProfitWithoutGas(quote2, using)];
    if (!profit1 || !profit2 || profit1 === profit2) {
      return 0;
    }
    return profit1 > profit2 ? -1 : 1;
  }
  // If we are comparing quotes for the same pair of tokens, then will simply compare swap ammounts
  const extract = amountExtractor(using);
  const { sellAmount: sellAmount1, buyAmount: buyAmount1 } = extract(quote1);
  const { sellAmount: sellAmount2, buyAmount: buyAmount2 } = extract(quote2);
  const quote1BuyAmountRelativeToQuote2 = ruleOfThree({ a: sellAmount1.amount, matchA: buyAmount1.amount, b: sellAmount2.amount });
  if (BigNumber.from(quote1BuyAmountRelativeToQuote2).gt(buyAmount2.amount)) {
    return -1;
  } else if (BigNumber.from(quote1BuyAmountRelativeToQuote2).lt(buyAmount2.amount)) {
    return 1;
  }
  return 0;
}

function compareLeastGas(quote1: ComparableQuote, quote2: ComparableQuote) {
  if (BigNumber.from(quote1.gas.estimatedGas).lt(quote2.gas.estimatedGas)) {
    return -1;
  } else if (BigNumber.from(quote1.gas.estimatedGas).gt(quote2.gas.estimatedGas)) {
    return 1;
  }
  return 0;
}

function calculateProfit(quote: ComparableQuote, using: CompareQuotesUsing) {
  const { sellAmount, buyAmount } = amountExtractor(using)(quote);
  const soldUSD = sellAmount.amountInUSD && Number(sellAmount.amountInUSD);
  const boughtUSD = buyAmount.amountInUSD && Number(buyAmount.amountInUSD);
  const gasCostUSD = quote.gas.estimatedCostInUSD && Number(quote.gas.estimatedCostInUSD);
  return !soldUSD || !boughtUSD || !gasCostUSD ? undefined : boughtUSD - soldUSD - gasCostUSD;
}

function calculateProfitWithoutGas(quote: ComparableQuote, using: CompareQuotesUsing) {
  const { sellAmount, buyAmount } = amountExtractor(using)(quote);
  const soldUSD = sellAmount.amountInUSD && Number(sellAmount.amountInUSD);
  const boughtUSD = buyAmount.amountInUSD && Number(buyAmount.amountInUSD);
  return !soldUSD || !boughtUSD ? undefined : boughtUSD - soldUSD;
}
