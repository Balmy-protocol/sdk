import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { calculateDeadline, isSameAddress } from '@shared/utils';
import { ChainId } from '@types';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.AURORA.chainId]: 'aurora',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.BIT_TORRENT.chainId]: 'bttc',
  [Chains.CRONOS.chainId]: 'cronos',
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.OASIS_EMERALD.chainId]: 'oasis',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.VELAS.chainId]: 'velas',
  [Chains.OPTIMISM.chainId]: 'optimism',
};

const KYBERSWAP_METADATA: QuoteSourceMetadata<KyberswapSupport> = {
  name: 'Kyberswap',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmNcTVyqeVtNoyrT546VgJTD4vsZEkWp6zhDJ4qhgKkhbK',
};
type KyberswapSupport = { buyOrders: false; swapAndTransfer: true };
export class KyberswapQuoteSource extends AlwaysValidConfigAndContexSource<KyberswapSupport> {
  getMetadata() {
    return KYBERSWAP_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom, recipient },
      config: { slippagePercentage, timeout, txValidFor },
    },
    config,
  }: QuoteParams<KyberswapSupport>): Promise<SourceQuoteResponse> {
    const chainKey = SUPPORTED_CHAINS[chain.chainId];
    let url =
      `https://aggregator-api.kyberswap.com/${chainKey}/route/encode` +
      `?tokenIn=${sellToken}` +
      `&tokenOut=${buyToken}` +
      `&amountIn=${order.sellAmount.toString()}` +
      `&slippageTolerance=${slippagePercentage * 100}` +
      `&to=${recipient ?? takeFrom}` +
      `&gasInclude=1`;

    if (txValidFor) {
      url += `&deadline=${calculateDeadline(txValidFor)}`;
    }

    if (config.referrer?.name) {
      url += `&clientData={"source": "${config.referrer.name}"}`;
    }

    const response = await fetchService.fetch(url, { timeout, headers: { 'Accept-Version': 'Latest' } });
    if (!response.ok) {
      failed(KYBERSWAP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const { outputAmount, totalGas, encodedSwapData, routerAddress } = await response.json();
    if (!encodedSwapData) {
      failed(KYBERSWAP_METADATA, chain, sellToken, buyToken, 'Failed to calculate a quote');
    }

    const value = isSameAddress(sellToken, Addresses.NATIVE_TOKEN) ? order.sellAmount : 0n;
    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(outputAmount),
      estimatedGas: BigInt(totalGas),
      allowanceTarget: calculateAllowanceTarget(sellToken, routerAddress),
      tx: {
        to: routerAddress,
        calldata: encodedSwapData,
        value,
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
