import qs from 'qs';
import { Chains } from '@chains';
import { ChainId } from '@types';
import { isSameAddress } from '@shared/utils';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, checksum, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

// Supported Networks: https://docs.bebop.xyz/bebop/bebop-api/api-introduction#smart-contract
const NETWORK_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
};

const BEBOP_METADATA: QuoteSourceMetadata<BebopSupport> = {
  name: 'Bebop',
  supports: {
    chains: Object.keys(NETWORK_KEY).map(Number),
    swapAndTransfer: true,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmTMusok8SqDoa1MDGgZ3xohrPTnY6j2xxR5jPphBDaUDi',
};
type BebopSupport = { buyOrders: true; swapAndTransfer: true };
export class BebopQuoteSource extends AlwaysValidConfigAndContextSource<BebopSupport> {
  getMetadata() {
    return BEBOP_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom, recipient },
    },
    config,
  }: QuoteParams<BebopSupport>): Promise<SourceQuoteResponse> {
    const queryParams = {
      sell_tokens: [checksum(sellToken)],
      buy_tokens: [checksum(buyToken)],
      sell_amounts: order.type === 'sell' ? [order.sellAmount.toString()] : undefined,
      buy_amounts: order.type === 'buy' ? [order.buyAmount.toString()] : undefined,
      taker_address: takeFrom,
      receiver_address: recipient && !isSameAddress(recipient, takeFrom) ? recipient : undefined,
      source: config.referrer?.name,
      skip_validation: config.disableValidation,
      gasless: false,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.bebop.xyz/${NETWORK_KEY[chain.chainId]}/v2/quote?${queryString}`;

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(BEBOP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      toSign: { taker_amounts, maker_amounts },
      approvalTarget,
      tx: { to, value, data, gas },
    } = await response.json();

    const quote = {
      sellAmount: BigInt(taker_amounts[0]),
      buyAmount: BigInt(maker_amounts[0]),
      estimatedGas: BigInt(gas),
      allowanceTarget: calculateAllowanceTarget(sellToken, approvalTarget),
      tx: {
        calldata: data,
        to,
        value: BigInt(value ?? 0),
      },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}
