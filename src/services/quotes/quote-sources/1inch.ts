import { BigNumber, constants } from "ethers"
import { Networks } from "@networks"
import { NoCustomConfigQuoteSource, QuoteComponents, QuoteSourceMetadata, SourceQuoteRequest, SourceQuoteResponse } from "./base"
import { IFetchService } from "@services/fetch/types"
import { addQuoteSlippage, failed, isNativeWrapOrUnwrap } from "./utils"

type OneInchSupport = { buyOrders: false, swapAndTransfer: true }
export class OneInchQuoteSource extends NoCustomConfigQuoteSource<OneInchSupport> {

  getMetadata(): QuoteSourceMetadata<OneInchSupport> {
    return {
      name: '1inch',
      supports: {
        networks: [
          Networks.ETHEREUM,
          Networks.BNB_CHAIN,
          Networks.POLYGON,
          Networks.OPTIMISM,
          Networks.ARBITRUM,
          Networks.GNOSIS,
          Networks.AVALANCHE,
          Networks.FANTOM,
          Networks.KLAYTN,
          Networks.AURORA,
        ],
        swapAndTransfer: true,
        buyOrders: false
      },
      logoURI: 'ipfs://QmNr5MnyZKUv7rMhMyZPbxPbtc1A1yAVAqEEgVbep1hdBx',
    }
  }

  async quote({ fetchService }: QuoteComponents, request: SourceQuoteRequest<OneInchSupport>): Promise<SourceQuoteResponse> {
    const [estimatedGas, { toTokenAmount, to, data, value }] = await Promise.all([
      this.getGasEstimate(fetchService, request),
      this.getQuote(fetchService, request)
    ])

    const quote = {
      sellAmount: request.order.sellAmount,
      buyAmount: BigNumber.from(toTokenAmount),
      calldata: data,
      estimatedGas,
      swapper: {
        allowanceTarget: to,
        address: to,
      },
      value: BigNumber.from(value ?? 0),
    }

    const isWrapOrUnwrap = isNativeWrapOrUnwrap(request.network, request.sellToken, request.buyToken)
    return addQuoteSlippage(quote, request.order.type, isWrapOrUnwrap ? 0 : request.config.slippagePercentage)
  }

  private async getQuote(fetchService: IFetchService, { network, sellToken, buyToken, order, config: { slippagePercentage, timeout }, accounts: { takeFrom, recipient } }: SourceQuoteRequest<OneInchSupport>) {
    let url =
      `https://api.1inch.io/v5.0/${network.chainId}/swap` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}` +
      `&fromAddress=${takeFrom}` +
      `&slippage=${slippagePercentage}` +
      `&disableEstimate=true`

    if (!!recipient && takeFrom !== recipient) {
      url += `&destReceiver=${recipient}`
    }

    if (this.globalConfig.referrerAddress) {
      url += `&referrerAddress=${this.globalConfig.referrerAddress}`
    }
    const response = await fetchService.fetch(url, { timeout })
    if (!response.ok) {
      failed(network, sellToken, buyToken)
    }
    const { toTokenAmount, tx: { to, data, value } } = await response.json()
    return { toTokenAmount, to, data, value }
  }

  // We can't use the gas estimate on the /swap endpoint because we need to turn the estimates off
  private async getGasEstimate(fetchService: IFetchService, { network, sellToken, buyToken, order, config: { timeout } }: SourceQuoteRequest<OneInchSupport>) {
    const url =
      `https://api.1inch.io/v5.0/${network.chainId}/quote` +
      `?fromTokenAddress=${sellToken}` +
      `&toTokenAddress=${buyToken}` +
      `&amount=${order.sellAmount.toString()}`

    const response = await fetchService.fetch(url, { timeout })
    if (!response.ok) {
      return constants.Zero
    }
    const { estimatedGas } = await response.json()
    return BigNumber.from(estimatedGas)
  }
}
