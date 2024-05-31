import { Chains } from '@chains';
import { StringifyBigInt } from '@utility-types';
import { QuoteTransaction } from '../types';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { SourceListQuoteResponse } from '../source-lists/types';

const SOVRYN_METADATA: QuoteSourceMetadata<SovrynSupport> = {
  name: 'Sovryn',
  supports: {
    chains: [Chains.ROOTSTOCK.chainId],
    buyOrders: false,
    swapAndTransfer: false,
  },
  logoURI: 'ipfs://QmUpdb1zxtB2kUSjR1Qs1QMFPsSeZNkL21fMzGUfdjkXQA',
};
type SovrynSupport = { buyOrders: false; swapAndTransfer: false };
type SovrynConfig = {};
type SovrynData = { tx: SourceQuoteTransaction };
export class SovrynQuoteSource extends AlwaysValidConfigAndContextSource<SovrynSupport, SovrynConfig, SovrynData> {
  getMetadata() {
    return SOVRYN_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom },
      order,
      external,
      ...request
    },
    config,
  }: QuoteParams<SovrynSupport>): Promise<SourceQuoteResponse<SovrynData>> {
    const url = `https://api.balmy.xyz/v1/swap/networks/${chain.chainId}/quotes/sovryn`;
    const body = {
      ...request,
      order: { type: 'sell', sellAmount: order.sellAmount.toString() },
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
      failed(SOVRYN_METADATA, chain, request.sellToken, request.buyToken, await response.text());
    }
    const {
      sellAmount,
      buyAmount,
      maxSellAmount,
      minBuyAmount,
      estimatedGas,
      source: { allowanceTarget },
      customData,
    }: StringifyBigInt<SourceListQuoteResponse> = await response.json();
    const tx = customData.tx as any as StringifyBigInt<QuoteTransaction>;

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
          calldata: tx.data,
          to: tx.to,
          value: BigInt(tx.value ?? 0),
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<SovrynConfig, SovrynData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
