import { IFetchService } from "@services/fetch/types"
import { IGasService } from "@services/gas/types"
import { IMulticallService } from "@services/multicall/types"
import { AvailableSources, IQuoteService } from "@services/quotes/types"
import { BaseToken, ITokenService } from "@services/tokens/types"

export type ISDK<SupportedSources extends AvailableSources, Token extends BaseToken> = {
  fetchService: IFetchService,
  gasService: IGasService,
  multicallService: IMulticallService,
  quoteService: IQuoteService<SupportedSources>,
  tokenService: ITokenService<Token>
}