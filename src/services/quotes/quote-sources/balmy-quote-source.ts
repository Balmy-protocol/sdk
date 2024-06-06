import { Chains } from '@chains';
import { Address } from '@types';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { SourceListQuoteResponse } from '../source-lists/types';
import { StringifyBigInt } from '@utility-types';
import { QuoteTransaction } from '../types';
import { bigintifyTx } from '../source-lists/utils';

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
  url?: string;
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
    const balmyUrl = config.url ?? 'https://api.balmy.xyz';
    const url = `${balmyUrl}/v1/swap/networks/${chain.chainId}/quotes/balmy`;
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
    }: StringifyBigInt<SourceListQuoteResponse<{ tx: QuoteTransaction }>> = await response.json();

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
          to: customData.tx.to,
          calldata: customData.tx.data,
          value: customData.tx.value ? BigInt(customData.tx.value) : undefined,
        },
      },
    };
  }

  async buildTx({ request }: BuildTxParams<BalmyConfig, BalmyData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }
}
