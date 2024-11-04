import qs from 'qs';
import { parseUnits } from 'viem';
import { Chains } from '@chains';
import { Address, ChainId, TokenAddress } from '@types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { BuildTxParams, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction } from './types';
import { addQuoteSlippage, calculateAllowanceTarget, failed } from './utils';
import { isSameAddress } from '@shared/utils';
import { Addresses } from '@shared/constants';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.BASE.chainId]: 'base',
  [Chains.POLYGON_ZKEVM.chainId]: 'polygonzk',
  [Chains.BLAST.chainId]: 'blast',
  [Chains.SCROLL.chainId]: 'scroll',
  [Chains.METIS_ANDROMEDA.chainId]: 'metis',
  [Chains.FANTOM.chainId]: 'fantom',
};

const MAGPIE_METADATA: QuoteSourceMetadata<MagpieSupport> = {
  name: 'Magpie',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmfR2ybY1gvctAxU5KArQ1UDXFixBY8ehgTBUBvUqY4Q4b',
};
type MagpieSupport = { buyOrders: false; swapAndTransfer: true };
type MagpieConfig = { sourceAllowlist?: string[] };
type MagpieData = { quoteId: string; takeFrom: Address; recipient: Address | undefined };
export class MagpieQuoteSource extends AlwaysValidConfigAndContextSource<MagpieSupport, MagpieConfig, MagpieData> {
  getMetadata() {
    return MAGPIE_METADATA;
  }

  async quote({
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
  }: QuoteParams<MagpieSupport, MagpieConfig>): Promise<SourceQuoteResponse<MagpieData>> {
    const quoteQueryParams = {
      network: SUPPORTED_CHAINS[chainId],
      fromTokenAddress: mapToken(sellToken),
      toTokenAddress: mapToken(buyToken),
      sellAmount: order.sellAmount.toString(),
      slippage: slippagePercentage / 100,
      liquiditySources: config.sourceAllowlist,
    };

    const quoteQueryString = qs.stringify(quoteQueryParams, { skipNulls: true, arrayFormat: 'comma' });
    const quoteUrl = `https://api.magpiefi.xyz/aggregator/quote?${quoteQueryString}`;
    const quoteResponse = await fetchService.fetch(quoteUrl, { timeout });
    if (!quoteResponse.ok) {
      failed(MAGPIE_METADATA, chainId, sellToken, buyToken, await quoteResponse.text());
    }
    const { id: quoteId, amountOut, targetAddress, fees } = await quoteResponse.json();
    const estimatedGasNum: `${number}` | undefined = fees.find((fee: { type: string; value: `${number}` }) => fee.type === 'gas')?.value;
    const estimatedGas = estimatedGasNum ? parseUnits(estimatedGasNum, 9) : undefined;

    const quote = {
      sellAmount: order.sellAmount,
      buyAmount: BigInt(amountOut),
      estimatedGas,
      allowanceTarget: calculateAllowanceTarget(sellToken, targetAddress),
      customData: { quoteId, takeFrom, recipient },
    };

    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      config: { timeout },
      customData: { quoteId, takeFrom, recipient },
    },
  }: BuildTxParams<MagpieConfig, MagpieData>): Promise<SourceQuoteTransaction> {
    const transactionQueryParams = {
      quoteId,
      toAddress: recipient ?? takeFrom,
      fromAddress: takeFrom,
      estimateGas: false,
    };
    const transactionQueryString = qs.stringify(transactionQueryParams, { skipNulls: true, arrayFormat: 'comma' });
    const transactionUrl = `https://api.magpiefi.xyz/aggregator/transaction?${transactionQueryString}`;
    const transactionResponse = await fetchService.fetch(transactionUrl, { timeout });
    if (!transactionResponse.ok) {
      failed(MAGPIE_METADATA, chainId, sellToken, buyToken, await transactionResponse.text());
    }
    const { to, value, data } = await transactionResponse.json();
    return { to, calldata: data, value: BigInt(value) };
  }
}

function mapToken(address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : address;
}
