import { BigNumber, utils } from 'ethers';
import { Chains } from '@chains';
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { failed } from './utils';
import { GasPrice } from '@services/gas/types';
import { ChainId } from '@types';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'eth',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.AVALANCHE.chainId]: 'avax',
  [Chains.HECO.chainId]: 'heco',
  [Chains.OKC.chainId]: 'okc',
  [Chains.GNOSIS.chainId]: 'xdai',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.MOONRIVER.chainId]: 'moonriver',
  [Chains.BOBA.chainId]: 'boba',
  [Chains.ONTOLOGY.chainId]: 'ont',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.HARMONY_SHARD_0.chainId]: 'harmony',
};

export const OPEN_OCEAN_METADATA: QuoteSourceMetadata<OpenOceanSupport> = {
  name: 'Open Ocean',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmP7bVENjMmobmjJcPFX6VbFTmj6pKmFNqv7Qkyqui44dT',
};
type OpenOceanSupport = { buyOrders: false; swapAndTransfer: true };
export class OpenOceanQuoteSource extends NoCustomConfigQuoteSource<OpenOceanSupport> {
  getMetadata() {
    return OPEN_OCEAN_METADATA;
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      chain,
      sellToken,
      sellTokenData,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
      context: { gasPrice: gasPricePromise },
    }: SourceQuoteRequest<OpenOceanSupport>
  ): Promise<SourceQuoteResponse> {
    const sellTokenDataResult = await sellTokenData;
    const legacyGasPrice = eip1159ToLegacy(await gasPricePromise);
    const gasPrice = parseFloat(utils.formatUnits(legacyGasPrice, 9));
    const amount = utils.formatUnits(order.sellAmount, sellTokenDataResult.decimals);
    const chainKey = SUPPORTED_CHAINS[chain.chainId];
    let url =
      `https://open-api.openocean.finance/v3/${chainKey}/swap_quote` +
      `?inTokenAddress=${sellToken}` +
      `&outTokenAddress=${buyToken}` +
      `&amount=${amount}` +
      `&slippage=${slippagePercentage}` +
      `&gasPrice=${gasPrice}` +
      `&account=${recipient ?? takeFrom}`;

    if (this.globalConfig.referrer?.address) {
      url += `&referrer=${this.globalConfig.referrer?.address}`;
    }
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(chain, sellToken, buyToken, await response.text());
    }
    const {
      data: { outAmount, estimatedGas, minOutAmount, to, value, data },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigNumber.from(outAmount),
      minBuyAmount: BigNumber.from(minOutAmount),
      type: 'sell',
      estimatedGas: BigNumber.from(estimatedGas),
      allowanceTarget: to,
      tx: {
        to,
        calldata: data,
        value: BigNumber.from(value ?? 0),
      },
    };
  }
}

function eip1159ToLegacy(gasPrice: GasPrice): BigNumber {
  if ('gasPrice' in gasPrice) {
    return BigNumber.from(gasPrice.gasPrice);
  }
  return BigNumber.from(gasPrice.maxFeePerGas);
}
