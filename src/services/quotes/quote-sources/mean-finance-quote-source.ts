import { Chains } from '@chains';
import { Address } from '@types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

export const MEAN_FINANCE_SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.OPTIMISM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.ARBITRUM,
  Chains.GNOSIS,
  Chains.BASE,
  Chains.BASE_GOERLI,
  Chains.MOONBEAM,
  // Chains.ROOTSTOCK,
].map(({ chainId }) => chainId);

const MEAN_METADATA: QuoteSourceMetadata<MeanFinanceSupport> = {
  name: 'Mean Finance',
  supports: {
    chains: MEAN_FINANCE_SUPPORTED_CHAINS,
    buyOrders: true,
    swapAndTransfer: true,
  },
  logoURI: 'ipfs://QmUUbaZvrD8Ymr2nV6db4Cbtd1aMCiSP7MoyvBv9LTnrmP',
};
type MeanFinanceConfig = {
  alwaysUseTransformers?: boolean;
  swapperContract?: Address;
  leftoverRecipient?: Address;
};
type MeanFinanceSupport = { buyOrders: true; swapAndTransfer: true };
export class MeanFinanceQuoteSource extends AlwaysValidConfigAndContextSource<MeanFinanceSupport, MeanFinanceConfig> {
  getMetadata() {
    return MEAN_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom, recipient },
      order,
      external,
      ...request
    },
    config,
  }: QuoteParams<MeanFinanceSupport, MeanFinanceConfig>): Promise<SourceQuoteResponse> {
    const url = `https://api.mean.finance/v1/swap/networks/${chain.chainId}/quotes/mean-finance`;
    const stringOrder =
      order.type === 'sell' ? { type: 'sell', sellAmount: order.sellAmount.toString() } : { type: 'buy', buyAmount: order.buyAmount.toString() };
    const body = {
      ...request,
      order: stringOrder,
      slippagePercentage,
      takerAddress: takeFrom,
      recipient,
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
      failed(MEAN_METADATA, chain, request.sellToken, request.buyToken, await response.text());
    }
    const {
      sellAmount,
      buyAmount,
      maxSellAmount,
      minBuyAmount,
      estimatedGas,
      source: { allowanceTarget },
      tx: { to, value, data },
    } = await response.json();

    return {
      sellAmount: BigInt(sellAmount),
      maxSellAmount: BigInt(maxSellAmount),
      buyAmount: BigInt(buyAmount),
      minBuyAmount: BigInt(minBuyAmount),
      estimatedGas: estimatedGas ? BigInt(estimatedGas) : undefined,
      allowanceTarget: calculateAllowanceTarget(request.sellToken, allowanceTarget),
      type: order.type,
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };
  }
}
