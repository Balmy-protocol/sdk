import qs from 'qs';
import { Chains } from '@chains';
import { Address, ChainId, Timestamp, TokenAddress } from '@types';
import { isSameAddress } from '@shared/utils';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, checksum, failed } from './utils';

// Supported Networks: https://docs.bebop.xyz/bebop/bebop-api/api-introduction#smart-contract
const NETWORK_KEY: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.BLAST.chainId]: 'blast',
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
type BebopConfig = { apiKey: string };
type BebopSupport = { buyOrders: true; swapAndTransfer: true };
type BebopData = { tx: SourceQuoteTransaction; expiry: Timestamp };
export class BebopQuoteSource implements IQuoteSource<BebopSupport, BebopConfig, BebopData> {
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
  }: QuoteParams<BebopSupport, BebopConfig>): Promise<SourceQuoteResponse<BebopData>> {
    const checksummedSellToken = checksum(sellToken);
    const checksummedBuyToken = checksum(buyToken);
    const checksummedTakerAddress = checksum(takeFrom);
    const checksummedRecipient = recipient && checksum(recipient);
    const queryParams = {
      sell_tokens: [checksummedSellToken],
      buy_tokens: [checksummedBuyToken],
      sell_amounts: order.type === 'sell' ? [order.sellAmount.toString()] : undefined,
      buy_amounts: order.type === 'buy' ? [order.buyAmount.toString()] : undefined,
      taker_address: checksummedTakerAddress,
      receiver_address: checksummedRecipient && !isSameAddress(checksummedRecipient, takeFrom) ? checksummedRecipient : undefined,
      source: config.referrer?.name,
      skip_validation: config.disableValidation,
      gasless: false,
      slippage: slippagePercentage,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.bebop.xyz/router/${NETWORK_KEY[chain.chainId]}/v1/quote?${queryString}`;

    const headers = { 'source-auth': config.apiKey };
    const response = await fetchService.fetch(url, { timeout, headers });
    if (!response.ok) {
      failed(BEBOP_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const result: BebopResult = await response.json();
    if ('error' in result) {
      failed(BEBOP_METADATA, chain, sellToken, buyToken, result.error.message);
    }
    const {
      sellTokens: {
        [checksummedSellToken]: { amount: sellAmount },
      },
      buyTokens: {
        [checksummedBuyToken]: { amount: buyAmount, minimumAmount: minBuyAmount },
      },
      approvalTarget,
      expiry,
      tx: { to, value, data, gas },
    } = result.routes[0].quote;

    return {
      sellAmount: BigInt(sellAmount),
      maxSellAmount: BigInt(sellAmount),
      buyAmount: BigInt(buyAmount),
      minBuyAmount: BigInt(minBuyAmount),
      estimatedGas: BigInt(gas),
      allowanceTarget: calculateAllowanceTarget(sellToken, approvalTarget),
      type: order.type,
      customData: {
        tx: {
          calldata: data,
          to,
          value: BigInt(value ?? 0),
        },
        expiry,
      },
    };
  }

  async buildTx({ request }: BuildTxParams<BebopConfig, BebopData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<BebopConfig> | undefined): config is BebopConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<BebopConfig> | undefined): config is BebopConfig {
    return true;
  }
}

type BebopResult = BebopSuccessfulResult | BebopErrorResult;
type BebopSuccessfulResult = {
  routes: {
    quote: {
      expiry: Timestamp;
      sellTokens: Record<TokenAddress, { amount: `${bigint}` }>;
      buyTokens: Record<TokenAddress, { amount: `${bigint}`; minimumAmount: `${bigint}` }>;
      approvalTarget: Address;
      tx: {
        to: string;
        value: string;
        data: string;
        gas: string;
      };
    };
  }[];
};

type BebopErrorResult = {
  error: {
    message: string;
  };
};
