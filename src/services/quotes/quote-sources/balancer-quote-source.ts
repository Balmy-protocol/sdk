import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { StringifyBigInt } from '@utility-types';
import { SourceListQuoteResponse } from '../source-lists';

const BALANCER_METADATA: QuoteSourceMetadata<BalancerSupport> = {
  name: 'Balancer',
  supports: {
    chains: [
      Chains.ARBITRUM.chainId,
      Chains.AVALANCHE.chainId,
      Chains.BASE.chainId,
      Chains.FANTOM.chainId,
      Chains.GNOSIS.chainId,
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.OPTIMISM.chainId,
      Chains.POLYGON_ZKEVM.chainId,
      Chains.ETHEREUM_SEPOLIA.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.SONIC.chainId,
      Chains.MODE.chainId,
    ],
    swapAndTransfer: false,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmSb9Lr6Jgi9Y3RUuShfWcuCaa9EYxpyZWgBTe8GbvsUL7',
};
type BalancerSupport = { buyOrders: true; swapAndTransfer: false };
type BalancerConfig = { url?: string };
type BalancerData = { tx: SourceQuoteTransaction };
export class BalancerQuoteSource extends AlwaysValidConfigAndContextSource<BalancerSupport, BalancerConfig, BalancerData> {
  getMetadata() {
    return BALANCER_METADATA;
  }
  async quote({
    components: { fetchService },
    request: {
      chainId,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom },
      order,
      external,
      ...request
    },
    config,
  }: QuoteParams<BalancerSupport, BalancerConfig>): Promise<SourceQuoteResponse<BalancerData>> {
    const balmyUrl = config.url ?? 'https://api.balmy.xyz';
    const url = `${balmyUrl}/v1/swap/networks/${chainId}/quotes/balancer`;
    const body = {
      ...request,
      order,
      slippagePercentage,
      takerAddress: takeFrom,
      txValidFor,
      quoteTimeout: timeout,
      sourceConfig: config,
    };

    const response = await fetchService.fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      timeout,
    });
    if (!response.ok) {
      failed(BALANCER_METADATA, chainId, request.sellToken, request.buyToken, await response.text());
    }
    const {
      sellAmount,
      buyAmount,
      maxSellAmount,
      minBuyAmount,
      estimatedGas,
      source: { allowanceTarget },
      customData,
    }: StringifyBigInt<SourceListQuoteResponse<{ tx: SourceQuoteTransaction }>> = await response.json();

    return {
      sellAmount: BigInt(sellAmount),
      maxSellAmount: BigInt(maxSellAmount),
      buyAmount: BigInt(buyAmount),
      minBuyAmount: BigInt(minBuyAmount),
      estimatedGas: estimatedGas ? BigInt(estimatedGas) : undefined,
      allowanceTarget: calculateAllowanceTarget(request.sellToken, allowanceTarget),
      type: order.type,
      customData: {
        tx: {
          ...customData.tx,
          value: customData.tx.value ? BigInt(customData.tx.value) : undefined,
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<BalancerConfig, BalancerData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
