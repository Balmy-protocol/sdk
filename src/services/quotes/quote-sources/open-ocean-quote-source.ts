import qs from 'qs';
import { Chains } from '@chains';
import { formatUnits } from 'viem';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { GasPrice } from '@services/gas/types';
import { ChainId } from '@types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

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
  [Chains.POLYGON_ZKEVM.chainId]: 'polygon_zkevm',
  [Chains.KAVA.chainId]: 'kava',
  [Chains.CELO.chainId]: 'celo',
  [Chains.LINEA.chainId]: 'linea',
  [Chains.BASE.chainId]: 'base',
};

const OPEN_OCEAN_METADATA: QuoteSourceMetadata<OpenOceanSupport> = {
  name: 'Open Ocean',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmP7bVENjMmobmjJcPFX6VbFTmj6pKmFNqv7Qkyqui44dT',
};
type OpenOceanSupport = { buyOrders: false; swapAndTransfer: true };
type OpenOceanConfig = { sourceAllowlist?: string[] };
export class OpenOceanQuoteSource extends AlwaysValidConfigAndContextSource<OpenOceanSupport, OpenOceanConfig> {
  getMetadata() {
    return OPEN_OCEAN_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout },
      external,
    },
    config,
  }: QuoteParams<OpenOceanSupport, OpenOceanConfig>): Promise<SourceQuoteResponse> {
    const [{ sellToken: sellTokenDataResult }, gasPriceResult] = await Promise.all([external.tokenData.request(), external.gasPrice.request()]);
    const legacyGasPrice = eip1159ToLegacy(gasPriceResult);
    const gasPrice = parseFloat(formatUnits(legacyGasPrice, 9));
    const amount = formatUnits(order.sellAmount, sellTokenDataResult.decimals);
    const chainKey = SUPPORTED_CHAINS[chain.chainId];
    const queryParams = {
      inTokenAddress: sellToken,
      outTokenAddress: buyToken,
      amount: amount,
      slippage: slippagePercentage,
      gasPrice: gasPrice,
      account: recipient ?? takeFrom,
      referrer: config.referrer?.address,
      enabledDexIds: config.sourceAllowlist,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://open-api.openocean.finance/v3/${chainKey}/swap_quote?${queryString}`;
    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(OPEN_OCEAN_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      data: { outAmount, estimatedGas, minOutAmount, to, value, data },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(outAmount),
      minBuyAmount: BigInt(minOutAmount),
      type: 'sell',
      estimatedGas: BigInt(estimatedGas),
      allowanceTarget: calculateAllowanceTarget(sellToken, to),
      tx: {
        to,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
  }
}

function eip1159ToLegacy(gasPrice: GasPrice): bigint {
  if ('gasPrice' in gasPrice) {
    return BigInt(gasPrice.gasPrice);
  }
  return BigInt(gasPrice.maxFeePerGas);
}
