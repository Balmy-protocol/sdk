import qs from 'qs';
import { Chains } from '@chains';
import { BaseTokenMetadata } from '@services/metadata/types';
import { Addresses } from '@shared/constants';
import { isSameAddress } from '@shared/utils';
import { Address, ChainId, TokenAddress } from '@types';
import { IQuoteSource, QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { calculateAllowanceTarget, failed } from './utils';
import { decodeFunctionData, parseAbi } from 'viem';

// https://docs.rango.exchange/integrations
const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: 'ETH',
  [Chains.BNB_CHAIN.chainId]: 'BSC',
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
  [Chains.POLYGON_ZKEVM.chainId]: 'POLYGONZK',
  [Chains.BLAST.chainId]: 'BLAST',
  [Chains.MODE.chainId]: 'MODE',
  [Chains.LINEA.chainId]: 'LINEA',
  [Chains.SCROLL.chainId]: 'SCROLL',
  [Chains.BASE.chainId]: 'BASE',
  [Chains.METIS_ANDROMEDA.chainId]: 'METIS',
  [Chains.ZK_SYNC_ERA.chainId]: 'ZKSYNC',
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
type RangoConfig = { apiKey: string; contractCall?: boolean };
type RangoSupport = { buyOrders: false; swapAndTransfer: true };
type RangoData = { tx: SourceQuoteTransaction; requestId: string };
export class RangoQuoteSource implements IQuoteSource<RangoSupport, RangoConfig, RangoData> {
  getMetadata() {
    return RANGO_METADATA;
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
      external: { tokenData },
    },
    config,
  }: QuoteParams<RangoSupport, RangoConfig>): Promise<SourceQuoteResponse<RangoData>> {
    const { sellToken: sellTokenDataResult, buyToken: buyTokenDataResult } = await tokenData.request();
    const chainKey = SUPPORTED_CHAINS[chainId];
    const queryParams = {
      apiKey: config.apiKey,
      from: mapToChainId(chainKey, sellToken, sellTokenDataResult),
      to: mapToChainId(chainKey, buyToken, buyTokenDataResult),
      amount: order.sellAmount.toString(),
      fromAddress: takeFrom,
      toAddress: recipient ?? takeFrom,
      disableEstimate: config.disableValidation,
      slippage: slippagePercentage,
      contractCall: config.contractCall,
    };
    const queryString = qs.stringify(queryParams, { skipNulls: true, arrayFormat: 'comma' });
    const url = `https://api.rango.exchange/basic/swap?${queryString}`;

    const response = await fetchService.fetch(url, { timeout });
    if (!response.ok) {
      failed(RANGO_METADATA, chainId, sellToken, buyToken, await response.text());
    }
    const {
      requestId,
      route: { outputAmount, outputAmountMin, fee },
      tx: { txTo, txData, value, gasLimit, gasPrice, approveData },
    } = await response.json();

    const gasCost = BigInt((fee as { name: string; amount: string }[]).find((fee) => fee.name === 'Network Fee')?.amount ?? 0);
    const estimatedGas = gasLimit ? BigInt(gasLimit) : gasCost / BigInt(gasPrice ?? 1);

    let allowanceTarget: Address = Addresses.ZERO_ADDRESS;
    if (approveData) {
      const { args } = decodeFunctionData({ abi: ABI, data: approveData });
      allowanceTarget = args[0];
    }

    const tx = {
      to: txTo,
      calldata: txData,
      value: BigInt(value ?? 0),
    };

    return {
      sellAmount: order.sellAmount,
      maxSellAmount: order.sellAmount,
      buyAmount: BigInt(outputAmount),
      minBuyAmount: BigInt(outputAmountMin),
      type: 'sell',
      estimatedGas,
      allowanceTarget: calculateAllowanceTarget(sellToken, allowanceTarget),
      customData: { tx, requestId },
    };
  }

  async buildTx({ request }: BuildTxParams<RangoConfig, RangoData>): Promise<SourceQuoteTransaction> {
    return request.customData.tx;
  }

  isConfigAndContextValidForQuoting(config: Partial<RangoConfig> | undefined): config is RangoConfig {
    return !!config?.apiKey;
  }

  isConfigAndContextValidForTxBuilding(config: Partial<RangoConfig> | undefined): config is RangoConfig {
    return true;
  }
}

function mapToChainId(chainKey: string, address: TokenAddress, metadata: BaseTokenMetadata) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? `${chainKey}.${metadata.symbol}` : `${chainKey}.${metadata.symbol}--${address}`;
}

const ABI = parseAbi(['function approve(address spender, uint256 value) returns (bool success)']);
