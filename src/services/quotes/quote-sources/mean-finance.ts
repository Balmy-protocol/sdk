import { BigNumber } from 'ethers';
import { Chains } from '@chains';
import { Address } from '@types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { failed } from './utils';
import { AlwaysValidConfigAndContexSource } from './base/always-valid-source';

const SUPPORTED_CHAINS = [Chains.ETHEREUM, Chains.OPTIMISM, Chains.POLYGON, Chains.BNB_CHAIN, Chains.ARBITRUM].map(({ chainId }) => chainId);

const MEAN_METADATA: QuoteSourceMetadata<MeanFinanceSupport> = {
  name: 'Mean Finance',
  supports: {
    chains: SUPPORTED_CHAINS,
    buyOrders: true,
    swapAndTransfer: true,
  },
  logoURI: 'ipfs://QmUUbaZvrD8Ymr2nV6db4Cbtd1aMCiSP7MoyvBv9LTnrmP',
};
type MeanFinanceConfig = {
  alwaysUseTransformerRegistry: boolean;
  swapperContract: Address;
  leftoverRecipient: Address;
};
type MeanFinanceSupport = { buyOrders: true; swapAndTransfer: true };
export class MeanFinanceQuoteSource extends AlwaysValidConfigAndContexSource<MeanFinanceSupport, MeanFinanceConfig> {
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
      quoteTiemout: timeout,
      sourceConfig: config,
    };

    const response = await fetchService.fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      timeout,
    });
    if (!response.ok) {
      failed(chain, request.sellToken, request.buyToken, await response.text());
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
      sellAmount: BigNumber.from(sellAmount),
      maxSellAmount: BigNumber.from(maxSellAmount),
      buyAmount: BigNumber.from(buyAmount),
      minBuyAmount: BigNumber.from(minBuyAmount),
      estimatedGas: BigNumber.from(estimatedGas),
      allowanceTarget,
      type: order.type,
      tx: {
        calldata: data,
        to,
        value: BigNumber.from(value ?? 0),
      },
    };
  }
}
