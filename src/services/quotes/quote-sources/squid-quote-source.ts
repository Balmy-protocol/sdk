import { Chains } from '@chains';
import { IQuoteSource } from './types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { calculateAllowanceTarget, failed } from './utils';

const SQUID_METADATA: QuoteSourceMetadata<SquidSupport> = {
  name: 'Squid',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.ARBITRUM.chainId,
      Chains.AVALANCHE.chainId,
      Chains.OPTIMISM.chainId,
      Chains.POLYGON.chainId,
      Chains.BASE.chainId,
      Chains.LINEA.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.FANTOM.chainId,
      Chains.MOONBEAM.chainId,
      Chains.CELO.chainId,
      Chains.KAVA.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmeSMmaVxJXK6b5afqH7xKNhP1hShoVeuDPHmXFkEe9hzN',
};
type SquidConfig = { integratorId: string };
type SquidSupport = { buyOrders: false; swapAndTransfer: true };
export class SquidQuoteSource implements IQuoteSource<SquidSupport, SquidConfig> {
  getMetadata() {
    return SQUID_METADATA;
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
    },
    config,
  }: QuoteParams<SquidSupport, SquidConfig>): Promise<SourceQuoteResponse> {
    const params = {
      fromChain: `${chain.chainId}`,
      toChain: `${chain.chainId}`,
      fromToken: sellToken,
      toToken: buyToken,
      fromAmount: order.sellAmount.toString(),
      fromAddress: takeFrom,
      toAddress: recipient ?? takeFrom,
      slippageConfig: {
        slippage: slippagePercentage,
      },
    };
    const headers = {
      'Content-Type': 'application/json',
      'x-integrator-id': config.integratorId,
    };
    const response = await fetchService.fetch('https://v2.api.squidrouter.com/v2/route', {
      method: 'POST',
      body: JSON.stringify(params),
      timeout,
      headers,
    });
    if (!response.ok) {
      failed(SQUID_METADATA, chain, sellToken, buyToken, await response.text());
    }

    const {
      route: {
        estimate: { toAmount, toAmountMin },
        transactionRequest: { data, gasLimit, target, value },
      },
    } = await response.json();

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(toAmount),
      minBuyAmount: BigInt(toAmountMin),
      type: 'sell',
      estimatedGas: BigInt(gasLimit),
      allowanceTarget: calculateAllowanceTarget(sellToken, target),
      tx: {
        to: target,
        calldata: data,
        value: BigInt(value ?? 0),
      },
    };
  }

  isConfigAndContextValid(config: Partial<SquidConfig> | undefined): config is SquidConfig {
    return !!config?.integratorId;
  }
}
