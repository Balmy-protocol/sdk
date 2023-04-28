import { Chains } from '@chains';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { Address, ChainId, TokenAddress } from '@types';
import { BigNumber } from 'ethers';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse } from './types';
import { failed } from './utils';
import { decodeFunctionData, parseAbi } from 'viem';

const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ETH',
  [Chains.BNB_CHAIN.chainId]: 'BNB',
  [Chains.POLYGON.chainId]: 'POLYGON',
  [Chains.FANTOM.chainId]: 'FANTOM',
  [Chains.ARBITRUM.chainId]: 'ARBITRUM',
  [Chains.CELO.chainId]: 'CELO',
  [Chains.OKC.chainId]: 'OKC',
  [Chains.MOONRIVER.chainId]: 'MOONRIVER',
  [Chains.MOONBEAM.chainId]: 'MOONBEAM',
  [Chains.OPTIMISM.chainId]: 'OPTIMISM',
  [Chains.GNOSIS.chainId]: 'GNOSIS',
  [Chains.HARMONY_SHARD_0.chainId]: 'HARMONY',
  [Chains.AVALANCHE.chainId]: 'AVAX_CCHAIN',
  [Chains.FUSE.chainId]: 'FUSE',
  [Chains.CRONOS.chainId]: 'CRONOS',
  [Chains.BOBA.chainId]: 'BOBA',
  [Chains.AURORA.chainId]: 'AURORA',
  [Chains.HECO.chainId]: 'HECO',
  [Chains.EVMOS.chainId]: 'EVMOS',
};

const RANGO_METADATA: QuoteSourceMetadata<RangoSupport> = {
  name: 'Rango',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  logoURI: 'ipfs://QmTvX3XyrFDSiDAKPJg9xFgn8DgQbp31wYWE8q7VhaR2c7',
};
type RangoConfig = { apiKey: string };
type RangoSupport = { buyOrders: false; swapAndTransfer: true };
export class RangoQuoteSource implements IQuoteSource<RangoSupport, RangoConfig> {
  getMetadata() {
    return RANGO_METADATA;
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
      external: { tokenData },
    },
    config,
  }: QuoteParams<RangoSupport, RangoConfig>): Promise<SourceQuoteResponse> {
    const { sellToken: sellTokenDataResult, buyToken: buyTokenDataResult } = await tokenData.request();
    const chainKey = SUPPORTED_CHAINS[chain.chainId];
    let url =
      `https://api.rango.exchange/basic/swap` +
      `?apiKey=${config.apiKey}` +
      `&from=${mapToChainId(chainKey, sellToken, sellTokenDataResult)}` +
      `&to=${mapToChainId(chainKey, buyToken, buyTokenDataResult)}` +
      `&amount=${order.sellAmount.toString()}` +
      `&fromAddress=${takeFrom}` +
      `&toAddress=${recipient ?? takeFrom}` +
      `&disableEstimate=true` +
      `&slippage=${slippagePercentage}`;

    if (config.referrer?.address) {
      url += `&referrerAddress=${config.referrer?.address}`;
    }

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(RANGO_METADATA, chain, sellToken, buyToken, await response.text());
    }
    const {
      route: { outputAmount, outputAmountMin, fee },
      tx: { txTo, txData, value, gasLimit, gasPrice, approveData },
    } = await response.json();

    const gasCost = BigNumber.from((fee as { name: string; amount: string }[]).find((fee) => fee.name === 'Network Fee')?.amount ?? 0);
    const estimatedGas = gasLimit ? BigNumber.from(gasLimit) : gasCost.div(gasPrice ?? 1);

    let allowanceTarget: Address = Addresses.ZERO_ADDRESS;
    if (approveData) {
      const { args } = decodeFunctionData({ abi: ABI, data: approveData });
      allowanceTarget = args[0];
    }

    const tx = {
      to: txTo,
      calldata: txData,
      value: BigNumber.from(value ?? 0),
    };

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigNumber.from(outputAmount),
      minBuyAmount: BigNumber.from(outputAmountMin),
      type: 'sell',
      estimatedGas,
      allowanceTarget,
      tx,
    };
  }

  isConfigAndContextValid(config: Partial<RangoConfig> | undefined): config is RangoConfig {
    return !!config?.apiKey;
  }
}

function mapToChainId(chainKey: string, address: TokenAddress, metadata: BaseTokenMetadata) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${chainKey}.${metadata.symbol}` : `${chainKey}.${metadata.symbol}--${address}`;
}

const ABI = parseAbi(['function approve(address spender, uint256 value) returns (bool success)']);
