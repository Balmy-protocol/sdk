import qs from 'qs';
import { Chains } from '@chains';
import { Addresses } from '@shared/constants';
import { QuoteParams, QuoteSourceMetadata, SourceQuoteResponse, SourceQuoteTransaction, BuildTxParams } from './types';
import { addQuoteSlippage, failed } from './utils';
import { Address, ChainId } from '@types';
import { AlwaysValidConfigAndContextSource } from './base/always-valid-source';
import { decodeFunctionData, parseAbi } from 'viem';
import { isSameAddress } from '@shared/utils';

// Supported Networks: https://platform.swing.xyz/api/v1/chains
const SUPPORTED_CHAINS: Record<ChainId, string> = {
  [Chains.ARBITRUM.chainId]: 'arbitrum',
  [Chains.AVALANCHE.chainId]: 'avalanche',
  [Chains.BASE.chainId]: 'base',
  [Chains.BNB_CHAIN.chainId]: 'bsc',
  [Chains.BLAST.chainId]: 'blast',
  [Chains.CELO.chainId]: 'celo',
  [Chains.ETHEREUM.chainId]: 'ethereum',
  [Chains.FANTOM.chainId]: 'fantom',
  [Chains.GNOSIS.chainId]: 'gnosis',
  [Chains.LINEA.chainId]: 'linea',
  [Chains.MANTLE.chainId]: 'mantle',
  [Chains.METIS_ANDROMEDA.chainId]: 'metis',
  [Chains.MODE.chainId]: 'mode',
  [Chains.MOONBEAM.chainId]: 'moonbeam',
  [Chains.OPTIMISM.chainId]: 'optimism',
  [Chains.POLYGON.chainId]: 'polygon',
  [Chains.ROOTSTOCK.chainId]: 'rootstock',
  [Chains.SCROLL.chainId]: 'scroll',
};

const SWING_METADATA: QuoteSourceMetadata<SwingSupport> = {
  name: 'Swing',
  supports: {
    chains: Object.keys(SUPPORTED_CHAINS).map(Number),
    swapAndTransfer: true,
    buyOrders: false,
  },
  // TODO: update after we have hash
  logoURI: 'ipfs://QmPQY4siKEJHZGW5F4JDBrUXCBFqfpnKzPA2xDmboeuZzL',
};
type SwingConfig = { projectId?: string };
type SwingSupport = { buyOrders: false; swapAndTransfer: true };
type SwingData = {
  chainKey: string;
  fromUserAddress: Address;
  toUserAddress: Address;
  tokenSymbol: string;
  fromTokenAddress: Address;
  toTokenSymbol: string;
  toTokenAddress: Address;
  tokenAmount: string;
  route: any;
  projectId: string;
};
export class SwingQuoteSource extends AlwaysValidConfigAndContextSource<SwingSupport, SwingConfig, SwingData> {
  getMetadata() {
    return SWING_METADATA;
  }

  async quote({
    components: { fetchService },
    request: {
      chainId,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout },
      accounts: { takeFrom, recipient },
      external: { tokenData },
    },
    config,
  }: QuoteParams<SwingSupport, SwingConfig>): Promise<SourceQuoteResponse<SwingData>> {
    const { sellToken: sellTokenDataResult, buyToken: buyTokenDataResult } = await tokenData.request();

    const chainKey = SUPPORTED_CHAINS[chainId];
    const projectId = config?.projectId ?? 'balmy';
    const quoteQueryParams = {
      fromChain: chainKey,
      fromTokenAddress: sellToken,
      tokenSymbol: sellTokenDataResult.symbol,
      fromUserAddress: takeFrom,
      toChain: chainKey,
      toTokenAddress: buyToken,
      toTokenSymbol: buyTokenDataResult.symbol,
      toUserAddress: recipient ?? takeFrom,
      tokenAmount: order.sellAmount.toString(),
      maxSlippage: slippagePercentage / 100,
      skipValidation: config.disableValidation,
      projectId,
    };
    const quoteQueryString = qs.stringify(quoteQueryParams, { skipNulls: true, arrayFormat: 'comma' });
    const quoteUrl = `https://swap.prod.swing.xyz/v0/transfer/quote?${quoteQueryString}`;

    const quoteResponse = await fetchService.fetch(quoteUrl, { timeout });
    if (!quoteResponse.ok) {
      failed(SWING_METADATA, chainId, sellToken, buyToken, await quoteResponse.text());
    }
    const { routes } = await quoteResponse.json();
    if (routes.length === 0) {
      throw new Error('No routes found');
    }
    const route = routes[0];
    const {
      quote: { amount: buyAmount, integration },
      gas,
    } = route;

    let allowanceTarget: Address = Addresses.ZERO_ADDRESS;
    if (!isSameAddress(sellToken, Addresses.NATIVE_TOKEN)) {
      const approvalQueryParams = {
        fromChain: chainKey,
        fromAddress: takeFrom,
        tokenAddress: sellToken,
        tokenSymbol: sellTokenDataResult.symbol,
        toTokenAddress: buyToken,
        toTokenSymbol: buyTokenDataResult.symbol,
        toChain: chainKey,
        tokenAmount: order.sellAmount.toString(),
        projectId,
        bridge: integration,
      };
      const approvalQueryString = qs.stringify(approvalQueryParams, { skipNulls: true, arrayFormat: 'comma' });
      const approvalUrl = `https://swap.prod.swing.xyz/v0/transfer/approve?${approvalQueryString}`;
      const approvalResponse = await fetchService.fetch(approvalUrl, { timeout });
      if (!approvalResponse.ok) {
        failed(SWING_METADATA, chainId, sellToken, buyToken, await approvalResponse.text());
      }
      const {
        tx: [{ data }],
      } = await approvalResponse.json();
      const { args } = decodeFunctionData({ abi: ABI, data });
      allowanceTarget = args[0];
    }

    const quote = {
      sellAmount: BigInt(order.sellAmount),
      buyAmount: BigInt(buyAmount),
      allowanceTarget,
      estimatedGas: gas != '0' ? BigInt(gas) : undefined,
      customData: {
        chainKey,
        fromUserAddress: takeFrom,
        toUserAddress: recipient ?? takeFrom,
        tokenSymbol: sellTokenDataResult.symbol,
        fromTokenAddress: sellToken,
        toTokenSymbol: buyTokenDataResult.symbol,
        toTokenAddress: buyToken,
        tokenAmount: order.sellAmount.toString(),
        maxSlippage: slippagePercentage / 100,
        route: route.route,
        projectId,
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }

  async buildTx({
    request: {
      chainId,
      sellToken,
      buyToken,
      customData,
      config: { timeout },
    },
    components: { fetchService },
    config,
  }: BuildTxParams<SwingConfig, SwingData>): Promise<SourceQuoteTransaction> {
    const sendParams = {
      ...customData,
      fromChain: customData.chainKey,
      toChain: customData.chainKey,
      skipValidation: config.disableValidation,
    };

    const sendResponse = await fetchService.fetch('https://swap.prod.swing.xyz/v0/transfer/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sendParams),
      timeout,
    });
    if (!sendResponse.ok) {
      failed(SWING_METADATA, chainId, sellToken, buyToken, await sendResponse.text());
    }
    const {
      tx: { data, to, value },
    } = await sendResponse.json();
    return { calldata: data, to, value: value ? BigInt(value) : undefined };
  }
}

const ABI = parseAbi(['function approve(address spender, uint256 value) returns (bool success)']);
