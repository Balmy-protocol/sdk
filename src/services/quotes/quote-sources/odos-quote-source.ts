import { Address } from '@types';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
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
      Chains.MODE.chainId,
      Chains.LINEA.chainId,
      Chains.MANTLE.chainId,
    ],
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qma71evDJfVUSBU53qkf8eDDysUgojsZNSnFRWa4qWragz',
};
const BALMY_REFERRAL_CODE = 1533410238;
type SourcesConfig = { sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] };
type OdosSupport = { buyOrders: false; swapAndTransfer: true };
type OdosConfig = { supportRFQs?: boolean; referralCode?: number } & SourcesConfig;
type OdosData = { pathId: string; userAddr: Address; recipient: Address };
export class OdosQuoteSource extends AlwaysValidConfigAndContextSource<OdosSupport, OdosConfig, OdosData> {
  getMetadata() {
    return ODOS_METADATA;
  }

  async quote(params: QuoteParams<OdosSupport, OdosConfig>): Promise<SourceQuoteResponse<OdosData>> {
    // Note: Odos supports simple and advanced quotes. Simple quotes may offer worse prices, but it resolves faster. Since the advanced quote
    //       might timeout, we will make two quotes (one simple and one advanced) and we'll return the simple one if the other one timeouts
    const simpleQuote = getQuote({ ...params, simple: true });
    const advancedQuote = timeoutPromise(getQuote({ ...params, simple: false }), params.request.config.timeout, { reduceBy: '100ms' });
    const [simple, advanced] = await Promise.allSettled([simpleQuote, advancedQuote]);

    if (advanced.status === 'fulfilled') {
      return advanced.value;
    } else if (simple.status === 'fulfilled') {
      return simple.value;
    } else {
      return Promise.reject(simple.reason);
    }
  }

  async buildTx({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      config: { timeout },
      customData: { pathId, userAddr, recipient },
    },
  }: BuildTxParams<OdosConfig, OdosData>): Promise<SourceQuoteTransaction> {
    const assembleResponse = await fetchService.fetch('https://api.odos.xyz/sor/assemble', {
      body: JSON.stringify({ userAddr, pathId, receiver: recipient }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });
    if (!assembleResponse.ok) {
      failed(ODOS_METADATA, chainId, sellToken, buyToken, await assembleResponse.text());
    }
    const {
      transaction: { data, to, value },
    }: AssemblyResponse = await assembleResponse.json();

    return {
      to,
      calldata: data,
      value: BigInt(value),
    };
  }
}

async function getQuote({
  simple,
  components: { fetchService },
  request: {
    chainId,
    sellToken,
    buyToken,
    order,
    accounts: { takeFrom, recipient },
    config: { slippagePercentage, timeout },
  },
  config,
}: QuoteParams<OdosSupport, OdosConfig> & { simple: boolean }): Promise<SourceQuoteResponse<OdosData>> {
  const checksummedSell = checksumAndMapIfNecessary(sellToken);
  const checksummedBuy = checksumAndMapIfNecessary(buyToken);
  const userAddr = checksum(takeFrom);
  const quoteBody = {
    chainId,
    inputTokens: [{ tokenAddress: checksummedSell, amount: order.sellAmount.toString() }],
    outputTokens: [{ tokenAddress: checksummedBuy, proportion: 1 }],
    userAddr,
    slippageLimitPercent: slippagePercentage,
    sourceWhitelist: config?.sourceAllowlist,
    sourceBlacklist: config?.sourceDenylist,
    simulate: !config.disableValidation,
    pathViz: false,
    disableRFQs: !config?.supportRFQs, // Disable by default
    referralCode: config?.referralCode ?? BALMY_REFERRAL_CODE, // If not set, we will use Balmy's code
    simple,
  };

  const [quoteResponse, routerResponse] = await Promise.all([
    fetchService.fetch('https://api.odos.xyz/sor/quote/v2', {
      body: JSON.stringify(quoteBody),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout,
    }),
    fetchService.fetch(`https://api.odos.xyz/info/router/v2/${chainId}`, {
      headers: { 'Content-Type': 'application/json' },
      timeout,
    }),
  ]);
  if (!quoteResponse.ok) {
    failed(ODOS_METADATA, chainId, sellToken, buyToken, await quoteResponse.text());
  }
  if (!routerResponse.ok) {
    failed(ODOS_METADATA, chainId, sellToken, buyToken, await routerResponse.text());
  }
  const {
    pathId,
    gasEstimate,
    outAmounts: [outputTokenAmount],
  }: QuoteResponse = await quoteResponse.json();

  const { address } = await routerResponse.json();

  const quote = {
    sellAmount: order.sellAmount,
    buyAmount: BigInt(outputTokenAmount),
    estimatedGas: BigInt(gasEstimate),
    allowanceTarget: calculateAllowanceTarget(sellToken, address),
    customData: {
      pathId,
      userAddr,
      recipient: recipient ? checksum(recipient) : userAddr,
    },
  };

  return addQuoteSlippage(quote, 'sell', slippagePercentage);
}

function checksumAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : checksum(address);
}

type QuoteResponse = {
  gasEstimate: number;
  pathId: string;
  outAmounts: string[];
};

type AssemblyResponse = {
  transaction: {
    to: Address;
    data: string;
    value: number;
  };
};
