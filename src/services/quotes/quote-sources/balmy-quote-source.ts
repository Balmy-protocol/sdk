import { Chains } from '@chains';
import { Address } from '@types';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { SourceListQuoteResponse } from '../source-lists/types';
import { StringifyBigInt } from '@utility-types';
import { QuoteTransaction } from '../types';

export const BALMY_SUPPORTED_CHAINS = [
  Chains.ETHEREUM,
  Chains.OPTIMISM,
  Chains.POLYGON,
  Chains.BNB_CHAIN,
  Chains.ARBITRUM,
  Chains.GNOSIS,
  Chains.BASE,
  Chains.MOONBEAM,
  Chains.ROOTSTOCK,
].map(({ chainId }) => chainId);

const BALMY_METADATA: QuoteSourceMetadata<BalmySupport> = {
  name: 'Balmy',
  supports: {
    chains: BALMY_SUPPORTED_CHAINS,
    buyOrders: true,
    swapAndTransfer: true,
  },
  logoURI: 'ipfs://QmU3GnALKonFNwkv42LWNoXdquFskWXPAiq6sYH7DKQPGJ',
};
type BalmyConfig = {
  alwaysUseTransformers?: boolean;
  swapperContract?: Address;
  leftoverRecipient?: Address;
};
type BalmySupport = { buyOrders: true; swapAndTransfer: true };
type BalmyData = { tx: SourceQuoteTransaction };
export class BalmyQuoteSource extends AlwaysValidConfigAndContextSource<BalmySupport, BalmyConfig, BalmyData> {
  getMetadata() {
    return BALMY_METADATA;
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
  }: QuoteParams<BalmySupport, BalmyConfig>): Promise<SourceQuoteResponse<BalmyData>> {
    const url = `https://api.balmy.xyz/v1/swap/networks/${chain.chainId}/quotes/balmy`;
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
      failed(BALMY_METADATA, chain, request.sellToken, request.buyToken, await response.text());
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

  async buildTx({ request }: BuildTxParams<BalmyConfig, BalmyData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
