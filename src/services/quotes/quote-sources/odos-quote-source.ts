import { getAddress } from 'viem';
import { Address } from '@types';
import { Chains } from '@chains';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { Addresses } from '@shared/constants';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { isSameAddress } from '@shared/utils';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';

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
    swapAndTransfer: false,
    buyOrders: false,
  },
  logoURI: 'ipfs://Qma71evDJfVUSBU53qkf8eDDysUgojsZNSnFRWa4qWragz',
};
const MEAN_REFERRAL_CODE = 1533410238;
type SourcesConfig = { sourceAllowlist?: string[]; sourceDenylist?: undefined } | { sourceAllowlist?: undefined; sourceDenylist?: string[] };
type OdosConfig = { supportRFQs?: boolean; referralCode?: number } & SourcesConfig;
type OdosSupport = { buyOrders: false; swapAndTransfer: false };
export class OdosQuoteSource extends AlwaysValidConfigAndContextSource<OdosSupport, OdosConfig> {
  getMetadata() {
    return ODOS_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chain,
      sellToken,
      buyToken,
      order,
      accounts: { takeFrom },
      config: { slippagePercentage, timeout },
    },
    config,
  }: QuoteParams<OdosSupport, OdosConfig>): Promise<SourceQuoteResponse> {
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
      simulate: false,
      pathViz: false,
      disableRFQs: !config?.supportRFQs, // Disable by default
      referralCode: config?.referralCode ?? MEAN_REFERRAL_CODE, // If not set, we will use Mean's code
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
      body: JSON.stringify({ userAddr: takeFrom, pathId }),
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
}

function checksumAndMapIfNecessary(address: Address) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? '0x0000000000000000000000000000000000000000' : checksum(address);
}

function checksum(address: Address) {
  return getAddress(address);
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
