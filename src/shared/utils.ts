import { BigNumber, constants, utils } from 'ethers';
import ms from 'ms';
import { Address, Chain, TimeString } from '@types';

export function isSameAddress(address1: Address, address2: Address) {
  return address1.toLowerCase() === address2.toLowerCase();
}

const PRECISION = 10000;
export function calculatePercentage(amount: BigNumber, percentage: number) {
  const numerator = amount.mul(Math.round((percentage * PRECISION) / 100));
  return numerator.mod(PRECISION).isZero() ? numerator.div(PRECISION) : numerator.div(PRECISION).add(1); // Round up
}

export function calculateDeadline(txValidFor?: TimeString) {
  return txValidFor ? Math.floor((Date.now() + ms(txValidFor)) / 1000) : undefined;
}

export function timeToSeconds(time: TimeString) {
  return Math.floor(ms(time) / 1000);
}

export function toUnits(amount: BigNumber, decimals: number, precision: number = 5): number {
  const magnitude = Math.pow(10, precision);
  return Math.round((parseFloat(utils.formatUnits(amount, decimals)) + Number.EPSILON) * magnitude) / magnitude;
}

export function calculateGasDetails(chain: Chain, gasCostNativeToken: BigNumber, nativeTokenPrice?: number) {
  return {
    estimatedCost: gasCostNativeToken,
    estimatedCostInUnits: parseFloat(utils.formatUnits(gasCostNativeToken, 18)),
    estimatedCostInUSD: amountToUSD(18, gasCostNativeToken, nativeTokenPrice),
    gasTokenSymbol: chain.currencySymbol,
  };
}

const USD_PRECISION = 8;
export function amountToUSD<Price extends number | undefined>(
  decimals: number,
  amount: BigNumber,
  usdPrice: Price,
  precision: number = 3
): Price {
  if (!!usdPrice) {
    const priceBN = utils.parseUnits(`${usdPrice.toFixed(USD_PRECISION)}`, USD_PRECISION);
    const magnitude = utils.parseUnits('1', decimals);
    const amountUSDBN = priceBN.mul(amount).div(magnitude);
    return toUnits(amountUSDBN, USD_PRECISION, precision) as Price;
  }
  return undefined as Price;
}

export async function filterRejectedResults<T>(promises: Promise<T>[]): Promise<T[]> {
  const results = await Promise.allSettled(promises);
  return results.filter((result): result is PromiseFulfilledResult<Awaited<T>> => result.status === 'fulfilled').map(({ value }) => value);
}

export function ruleOfThree({ a, matchA, b }: { a: BigNumber; matchA: BigNumber; b: BigNumber }) {
  if (b.isZero() || matchA.isZero()) return constants.Zero;
  return b.mul(matchA).div(a);
}
