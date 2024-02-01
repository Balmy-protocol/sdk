import { Address } from '@types';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { Addresses } from '@shared/constants';
import { timeoutPromise } from '@shared/timeouts';
import { isSameAddress } from '@shared/utils';
import { addQuoteSlippage, calculateAllowanceTarget, checksum, failed } from './utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

// Supported Networks: https://docs.odos.xyz/#future-oriented-and-scalable
const ODOS_METADATA: QuoteSourceMetadata<OdosSupport> = {
  name: 'Odos',
  supports: {
    chains: [
      Chains.ETHEREUM.chainId,
      Chains.POLYGON.chainId,
      Chains.ARBITRUM.chainId,
      Chains.OPTIMISM.chainId,
      Chains.AVALANCHE.chainId,
      Chains.BNB_CHAIN.chainId,
      Chains.FANTOM.chainId,
      Chains.BASE_GOERLI.chainId,
      Chains.BASE.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qma71evDJfVUSBU53qkf8eDDysUgojsZNSnFRWa4qWragz',
};
const MEAN_REFERRAL_CODE = 1533410238;
type SourcesConfig = { sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] };
type OdosConfig = { supportRFQs?: boolean; referralCode?: number } & SourcesConfig;
type OdosSupport = { buyOrders: false; swapAndTransfer: true };
export class OdosQuoteSource extends AlwaysValidConfigAndContextSource<OdosSupport, OdosConfig> {
  getMetadata() {
    return ODOS_METADATA;
  }

  async quote(params: QuoteParams<OdosSupport, OdosConfig>): Promise<SourceQuoteResponse> {
    // Note: Odos supports simple and advanced quotes. Simple quotes may offer worse prices, but it resolves faster. Since the advanced quote
    //       might timeout, we will make two quotes (one simple and one advanced) and we'll return the simple one if the other one timeouts
    const simple = getQuote({ ...params, simple: true });
    const advanced = timeoutPromise(getQuote({ ...params, simple: false }), params.request.config.timeout, { reduceBy: '100ms' });
    return await advanced.catch(() => simple);
  }
}

async function getQuote({
  simple,
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
}: QuoteParams<OdosSupport, OdosConfig> & { simple: boolean }): Promise<SourceQuoteResponse> {
  const checksummedSell = checksumAndMapIfNecessary(sellToken);
  const checksummedBuy = checksumAndMapIfNecessary(buyToken);
  const quoteBody = {
    chainId: chain.chainId,
    inputTokens: [{ tokenAddress: checksummedSell, amount: order.sellAmount.toString() }],
    outputTokens: [{ tokenAddress: checksummedBuy, proportion: 1 }],
    userAddr: checksum(takeFrom),
    slippageLimitPercent: slippagePercentage,
    sourceWhitelist: config?.sourceAllowlist,
    sourceBlacklist: config?.sourceDenylist,
    simulate: !config.disableValidation,
    pathViz: false,
    disableRFQs: !config?.supportRFQs, // Disable by default
    referralCode: config?.referralCode ?? MEAN_REFERRAL_CODE, // If not set, we will use Mean's code
    simple,
  };

  const quoteResponse = await fetchService.fetch('https://api.odos.xyz/sor/quote/v2', {
    body: JSON.stringify(quoteBody),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout,
  });
  if (!quoteResponse.ok) {
    failed(ODOS_METADATA, chain, sellToken, buyToken, await quoteResponse.text());
  }
  const {
    pathId,
    outAmounts: [outputTokenAmount],
  }: QuoteResponse = await quoteResponse.json();

  const assembleResponse = await fetchService.fetch('https://api.odos.xyz/sor/assemble', {
    body: JSON.stringify({ userAddr: takeFrom, pathId, receiver: recipient }),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout,
  });
  if (!assembleResponse.ok) {
    failed(ODOS_METADATA, chain, sellToken, buyToken, await assembleResponse.text());
  }
  const {
    gasEstimate,
    transaction: { data, to, value },
  }: AssemblyResponse = await assembleResponse.json();

  const quote = {
    sellAmount: order.sellAmount,
    buyAmount: BigInt(outputTokenAmount),
    calldata: data,
    estimatedGas: BigInt(gasEstimate),
    allowanceTarget: calculateAllowanceTarget(sellToken, to),
    tx: {
      to,
      calldata: data,
      value: BigInt(value),
    },
  };

  return addQuoteSlippage(quote, 'sell', slippagePercentage);
}

function checksumAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : checksum(address);
}

type QuoteResponse = {
  pathId: string;
  outAmounts: string[];
};

type AssemblyResponse = {
  gasEstimate: number;
  transaction: {
    to: Address;
    data: string;
    value: number;
  };
};
