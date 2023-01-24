import { BigNumber, Contract } from 'ethers';
import { Chains } from '@chains';
import { ChainId, Chain, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { isSameAddress, calculatePercentage, timeToSeconds } from '@shared/utils';
import { NoCustomConfigQuoteSource, QuoteSourceMetadata, QuoteComponents, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

const ROUTER_ADDRESS: Record<ChainId, string> = {
  [Chains.ETHEREUM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Chains.OPTIMISM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Chains.POLYGON.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Chains.ARBITRUM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Chains.CELO.chainId]: '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
  [Chains.ETHEREUM_GOERLI.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Chains.POLYGON_MUMBAI.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
};

export const UNISWAP_METADATA: QuoteSourceMetadata<UniswapSupport> = {
  name: 'Uniswap',
  supports: {
    chains: Object.keys(ROUTER_ADDRESS).map(Number),
    swapAndTransfer: true,
    buyOrders: true,
  },
  logoURI: 'ipfs://QmNa3YBYAYS5qSCLuXataV5XCbtxP9ZB4rHUfomRxrpRhJ',
};
type UniswapSupport = { buyOrders: true; swapAndTransfer: true };
export class UniswapQuoteSource extends NoCustomConfigQuoteSource<UniswapSupport> {
  getMetadata() {
    return UNISWAP_METADATA;
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      chain,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom, recipient },
    }: SourceQuoteRequest<UniswapSupport>
  ): Promise<SourceQuoteResponse> {
    const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
    const isSellTokenNativeToken = isSameAddress(sellToken, Addresses.NATIVE_TOKEN);
    const isBuyTokenNativeToken = isSameAddress(buyToken, Addresses.NATIVE_TOKEN);
    const router = ROUTER_ADDRESS[chain.chainId];
    recipient = recipient ?? takeFrom;
    const url =
      'https://api.uniswap.org/v1/quote' +
      '?protocols=v2,v3,mixed' +
      `&tokenInAddress=${mapToWTokenIfNecessary(chain, sellToken)}` +
      `&tokenInChainId=${chain.chainId}` +
      `&tokenOutAddress=${mapToWTokenIfNecessary(chain, buyToken)}` +
      `&tokenOutChainId=${chain.chainId}` +
      `&amount=${amount.toString()}` +
      `&type=${order.type === 'sell' ? 'exactIn' : 'exactOut'}` +
      `&recipient=${isBuyTokenNativeToken ? router : recipient}` +
      `&deadline=${timeToSeconds(txValidFor ?? '3h')}` +
      `&slippageTolerance=${slippagePercentage}`;

    // These are needed so that the API allows us to make the call
    const headers = {
      origin: 'https://app.uniswap.org',
      referer: 'https://app.uniswap.org/',
    };
    const response = await fetchService.fetch(url, { headers, timeout });
    const body = await response.json();
    if (!response.ok) {
      failed(chain, sellToken, buyToken, body);
    }
    let {
      quote: quoteAmount,
      methodParameters: { calldata },
      gasUseEstimate,
    } = body;
    const value = isSellTokenNativeToken && order.type === 'sell' ? order.sellAmount : undefined;
    const buyAmount = order.type === 'sell' ? BigNumber.from(quoteAmount) : order.buyAmount;

    if (isBuyTokenNativeToken) {
      // Use multicall to unwrap wToken
      const minBuyAmount = calculateMinBuyAmount(order.type, buyAmount, slippagePercentage);
      const routerContract = new Contract(router, ROUTER_ABI);
      const { data: unwrapData } = await routerContract.populateTransaction.unwrapWETH9(minBuyAmount, recipient);
      const { data: multicallData } = await routerContract.populateTransaction.multicall([calldata, unwrapData]);

      // Update calldata and gas estimate
      calldata = multicallData!;
      gasUseEstimate = BigNumber.from(gasUseEstimate).add(12_500);
    }

    const quote = {
      sellAmount: order.type === 'sell' ? order.sellAmount : BigNumber.from(quoteAmount),
      buyAmount,
      estimatedGas: BigNumber.from(gasUseEstimate),
      allowanceTarget: router,
      tx: {
        to: router,
        calldata,
        value,
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}

function calculateMinBuyAmount(type: 'sell' | 'buy', buyAmount: BigNumber, slippagePercentage: number) {
  return type === 'sell' ? buyAmount.sub(calculatePercentage(buyAmount, slippagePercentage)) : buyAmount;
}

function mapToWTokenIfNecessary(chain: Chain, address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? chain.wToken : address;
}

const ROUTER_ABI = [
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
  'function multicall(bytes[] data) payable returns (bytes[] memory results)',
];
