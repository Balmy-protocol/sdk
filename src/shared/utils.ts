import { BigNumber, utils } from "ethers";
import ms from "ms";
import { Network, TimeString, TokenAddress } from "@types";

export function isSameAddress(tokenA: TokenAddress, tokenB: TokenAddress) {
  return tokenA.toLowerCase() === tokenB.toLowerCase()
}

const PRECISION = 10000
export function calculatePercentage(amount: BigNumber, percentage: number) {
  const numerator = amount.mul(Math.round(percentage * PRECISION / 100))
  return numerator.mod(PRECISION).isZero()
    ? numerator.div(PRECISION)
    : numerator.div(PRECISION).add(1) // Round up
}

export function calculateDeadline(txValidFor?: TimeString) {
  return txValidFor
    ? Math.floor((Date.now() + ms(txValidFor)) / 1000)
    : undefined
}

export function toUnits(amount: BigNumber, decimals: number, precision: number = 5): number {
  const magnitude = Math.pow(10, precision)
  return Math.round((parseFloat(utils.formatUnits(amount, decimals)) + Number.EPSILON) * magnitude) / magnitude
}

export function calculateGasDetails(network: Network, gasCostNativeToken: BigNumber, nativeTokenPrice?: number) {
  return {
    estimatedCost: gasCostNativeToken,
    estimatedCostInUnits: parseFloat(utils.formatUnits(gasCostNativeToken, 18)),
    estimatedCostInUSD: amountToUSD(18, gasCostNativeToken, nativeTokenPrice),
    gasTokenSymbol: network.currencySymbol,
  }
}

const USD_PRECISION = 8
export function amountToUSD<Price extends number | undefined>(decimals: number, amount: BigNumber, usdPrice: Price, precision: number = 3): Price {
  if (!!usdPrice) {
    const priceBN = utils.parseUnits(`${usdPrice.toFixed(USD_PRECISION)}`, USD_PRECISION)
    const magnitude = utils.parseUnits('1', decimals)
    const amountUSDBN = priceBN.mul(amount).div(magnitude)
    return toUnits(amountUSDBN, USD_PRECISION, precision) as Price
  }
  return undefined as Price
}