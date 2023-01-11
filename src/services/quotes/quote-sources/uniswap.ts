import { BigNumber, Contract } from 'ethers';
import { Networks } from '@networks';
import { ChainId, Network, TokenAddress } from '@types';
import { Addresses } from '@shared/constants';
import { isSameAddress, calculatePercentage, timeToSeconds } from '@shared/utils';
import { NoCustomConfigQuoteSource, QuoteSourceMetadata, QuoteComponents, SourceQuoteRequest, SourceQuoteResponse } from './base';
import { addQuoteSlippage, failed } from './utils';

const ROUTER_ADDRESS: Record<ChainId, string> = {
  [Networks.ETHEREUM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Networks.OPTIMISM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Networks.POLYGON.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Networks.ARBITRUM.chainId]: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  [Networks.CELO.chainId]: '0x5615CDAb10dc425a742d643d949a7F474C01abc4',
};
type UniswapSupport = { buyOrders: true; swapAndTransfer: true };
export class UniswapQuoteSource extends NoCustomConfigQuoteSource<UniswapSupport> {
  getMetadata(): QuoteSourceMetadata<UniswapSupport> {
    return {
      name: 'Uniswap',
      supports: {
        networks: Object.keys(ROUTER_ADDRESS).map((chainId) => Networks.byKeyOrFail(chainId)),
        swapAndTransfer: true,
        buyOrders: true,
      },
      logoURI: 'ipfs://QmNa3YBYAYS5qSCLuXataV5XCbtxP9ZB4rHUfomRxrpRhJ',
    };
  }

  async quote(
    { fetchService }: QuoteComponents,
    {
      network,
      sellToken,
      buyToken,
      order,
      config: { slippagePercentage, timeout, txValidFor },
      accounts: { takeFrom, recipient },
    }: SourceQuoteRequest<UniswapSupport>
  ): Promise<SourceQuoteResponse> {
    const amount = order.type === 'sell' ? order.sellAmount : order.buyAmount;
    const isSellTokenNetworkToken = isSameAddress(sellToken, Addresses.NATIVE_TOKEN);
    const isBuyTokenNetworkToken = isSameAddress(buyToken, Addresses.NATIVE_TOKEN);
    const router = ROUTER_ADDRESS[network.chainId];
    recipient = recipient ?? takeFrom;
    const url =
      'https://api.uniswap.org/v1/quote' +
      '?protocols=v2,v3' +
      `&tokenInAddress=${mapToWTokenIfNecessary(network, sellToken)}` +
      `&tokenInChainId=${network.chainId}` +
      `&tokenOutAddress=${mapToWTokenIfNecessary(network, buyToken)}` +
      `&tokenOutChainId=${network.chainId}` +
      `&amount=${amount.toString()}` +
      `&type=${order.type === 'sell' ? 'exactIn' : 'exactOut'}` +
      `&recipient=${isBuyTokenNetworkToken ? router : recipient}` +
      `&deadline=${timeToSeconds(txValidFor ?? '1y')}` +
      `&slippageTolerance=${slippagePercentage}`;

    // These are needed so that the API allows us to make the call
    const headers = {
      origin: 'https://app.uniswap.org',
      referer: 'https://app.uniswap.org/',
    };
    const response = await fetchService.fetch(url, { headers, timeout });
    const body = await response.json();
    if (!response.ok) {
      failed(network, sellToken, buyToken, body);
    }
    let {
      quote: quoteAmount,
      methodParameters: { calldata },
      gasUseEstimate,
    } = body;
    const value = isSellTokenNetworkToken && order.type === 'sell' ? order.sellAmount : undefined;
    const buyAmount = order.type === 'sell' ? BigNumber.from(quoteAmount) : order.buyAmount;

    if (isBuyTokenNetworkToken) {
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
      calldata,
      estimatedGas: BigNumber.from(gasUseEstimate),
      value,
      swapper: {
        address: router,
        allowanceTarget: router,
      },
    };
    return addQuoteSlippage(quote, order.type, slippagePercentage);
  }
}

function calculateMinBuyAmount(type: 'sell' | 'buy', buyAmount: BigNumber, slippagePercentage: number) {
  return type === 'sell' ? buyAmount.sub(calculatePercentage(buyAmount, slippagePercentage)) : buyAmount;
}

function mapToWTokenIfNecessary(network: Network, address: TokenAddress) {
  return isSameAddress(address, Addresses.NATIVE_TOKEN) ? network.wToken : address;
}

const ROUTER_ABI = [
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
  'function multicall(bytes[] data) payable returns (bytes[] memory results)',
];
