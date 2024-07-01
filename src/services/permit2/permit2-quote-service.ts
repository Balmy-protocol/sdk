import { EstimatedQuoteResponseWithTx, IPermit2QuoteService, IPermit2Service, PermitData, SinglePermitParams } from './types';
import { PERMIT2_ADAPTER_CONTRACT, PERMIT2_SUPPORTED_CHAINS } from './utils/config';
import { Address, ChainId, TimeString, TokenAddress } from '@types';
import { CompareQuotesBy, CompareQuotesUsing, QuoteResponse, IQuoteService, sortQuotesBy } from '@services/quotes';
import { calculateGasDetails, handleResponseFailure } from '@services/quotes/quote-service';
import {
  EstimatedQuoteRequest,
  FailedResponse,
  IgnoreFailedResponses,
  QuoteResponseWithTx,
  SourceId,
  SourceMetadata,
} from '@services/quotes/types';
import { calculateDeadline, isSameAddress, toAmountsOfToken } from '@shared/utils';
import { encodeFunctionData, decodeAbiParameters, parseAbiParameters, Hex, Address as ViemAddress } from 'viem';
import permit2AdapterAbi from '@shared/abis/permit2-adapter';
import { Either } from '@utility-types';
import { IGasService } from '@services/gas';
import { Addresses } from '@shared/constants';
import { IProviderService } from '..';

export class Permit2QuoteService implements IPermit2QuoteService {
  readonly permit2AdapterContract = PERMIT2_ADAPTER_CONTRACT;

  constructor(
    private readonly permit2Service: IPermit2Service,
    private readonly quotesService: IQuoteService,
    private readonly providerService: IProviderService,
    private readonly gasService: IGasService
  ) {}

  preparePermitData(args: SinglePermitParams): Promise<PermitData> {
    return this.permit2Service.preparePermitData({ ...args, spender: this.permit2AdapterContract.address(args.chainId) });
  }

  supportedSources() {
    const supportedChains = this.supportedChains();
    // Filter out unsupported chains
    const sources: [SourceId, SourceMetadata][] = Object.entries(this.quotesService.supportedSources()).map(([sourceId, source]) => [
      sourceId,
      { ...source, supports: { ...source.supports, chains: source.supports.chains.filter((chainId) => supportedChains.includes(chainId)) } },
    ]);
    return Object.fromEntries(sources);
  }

  supportedChains() {
    return PERMIT2_SUPPORTED_CHAINS;
  }

  supportedSourcesInChain({ chainId }: { chainId: ChainId }) {
    const sourcesInChain = Object.entries(this.supportedSources()).filter(([, source]) => source.supports.chains.includes(chainId));
    return Object.fromEntries(sourcesInChain);
  }

  supportedGasSpeeds() {
    return this.quotesService.supportedGasSpeeds();
  }

  estimateQuotes({ request, config }: { request: EstimatedQuoteRequest; config?: { timeout?: TimeString } }) {
    const quotes = this.quotesService.getQuotes({
      request: { ...request, takerAddress: this.permit2AdapterContract.address(request.chainId) },
      config: config,
    });
    const txs = this.quotesService.buildTxs({ quotes, config });

    const result: Record<SourceId, Promise<EstimatedQuoteResponseWithTx>> = {};
    for (const sourceId in quotes) {
      result[sourceId] = Promise.all([quotes[sourceId], txs[sourceId]]).then(([{ accounts, ...quote }, estimatedTx]) => ({
        ...quote,
        customData: {
          ...quote.customData,
          estimatedTx,
        },
      }));
    }
    return result;
  }

  async estimateAllQuotes<IgnoreFailed extends boolean = true>({
    request,
    config,
  }: {
    request: EstimatedQuoteRequest;
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
      timeout?: TimeString;
    };
  }) {
    const metadata = this.supportedSources();
    const quotes = Object.entries(this.estimateQuotes({ request, config })).map(([sourceId, response]) =>
      handleResponseFailure(sourceId, response, metadata)
    );

    const responses = await Promise.all(quotes);
    const successfulQuotes = responses.filter((response): response is EstimatedQuoteResponseWithTx => !('failed' in response));
    const failedQuotes = config?.ignoredFailed === false ? responses.filter((response): response is FailedResponse => 'failed' in response) : [];

    const sortedQuotes = sortQuotesBy(successfulQuotes, config?.sort?.by ?? 'most-swapped', config?.sort?.using ?? 'sell/buy amounts');

    return [...sortedQuotes, ...failedQuotes] as IgnoreFailedResponses<IgnoreFailed, EstimatedQuoteResponseWithTx>[];
  }

  async buildAndSimulateQuotes<IgnoreFailed extends boolean = true>({
    chainId,
    quotes: estimatedQuotes,
    config,
    ...quoteData
  }: {
    chainId: ChainId;
    quotes: EstimatedQuoteResponseWithTx[];
    takerAddress: Address;
    recipient?: Address;
    config?: {
      ignoredFailed?: IgnoreFailed;
      sort?: {
        by: CompareQuotesBy;
        using?: CompareQuotesUsing;
      };
    };
  } & Either<{ permitData?: PermitData['permitData'] & { signature: string } }, { txValidFor?: TimeString }>): Promise<
    IgnoreFailedResponses<IgnoreFailed, QuoteResponseWithTx>[]
  > {
    const quotes = estimatedQuotes.map((estimatedQuote) => buildRealQuote(quoteData, estimatedQuote, chainId));
    const encoded = quotes.filter((response): response is QuoteResponseWithTx => !('failed' in response));
    const responses = await this.verifyAndCorrect(chainId, quoteData.takerAddress, encoded);

    if (config?.sort) {
      const successfulQuotes = responses.filter((response): response is QuoteResponseWithTx => !('failed' in response));
      const failedQuotes =
        config?.ignoredFailed === false
          ? [
              ...quotes.filter((response): response is FailedResponse => 'failed' in response),
              ...responses.filter((response): response is FailedResponse => 'failed' in response),
            ]
          : [];

      const sortedQuotes = sortQuotesBy(successfulQuotes, config.sort.by, config.sort.using ?? 'sell/buy amounts');
      return [...sortedQuotes, ...failedQuotes] as IgnoreFailedResponses<IgnoreFailed, QuoteResponseWithTx>[];
    }

    // Don't sort, but filter out failed if needed
    const result =
      config?.ignoredFailed === false ? responses : responses.filter((response): response is QuoteResponseWithTx => !('failed' in response));
    return result as IgnoreFailedResponses<IgnoreFailed, QuoteResponseWithTx>[];
  }

  private async verifyAndCorrect(
    chainId: ChainId,
    takerAddress: Address,
    quotes: QuoteResponseWithTx[]
  ): Promise<(QuoteResponseWithTx | FailedResponse)[]> {
    const calls = quotes.map(({ tx }) => tx.data);
    const maxValue = quotes.reduce((max, { tx: { value } }) => (value && max < (BigInt(value) ?? 0n) ? BigInt(value) : max), 0n);
    const [gasCalculator, encodedResults] = await Promise.all([
      this.gasService.getQuickGasCalculator({ chainId, config: { timeout: '2s' } }),
      this.simulate({ chainId, calls, account: takerAddress, value: maxValue }),
    ]);
    const decodedResults = encodedResults.map(({ success, result, gasSpent }) => {
      const [amountIn, amountOut] = success ? decodeAbiParameters(parseAbiParameters('uint256 amountIn, uint256 amountOut'), result) : [0n, 0n];
      return { success, gasSpent, amountIn, amountOut, rawResult: result };
    });
    return quotes.map((quote, i) => {
      const { success, amountIn, amountOut, gasSpent, rawResult } = decodedResults[i];
      if (!success) {
        return {
          failed: true,
          source: {
            id: quote.source.id,
            name: quote.source.name,
            logoURI: quote.source.logoURI,
          },
          error: `Failed with ${rawResult}`,
        };
      }
      const sellAmount = toAmountsOfToken({ ...quote.sellToken, amount: amountIn });
      const buyAmount = toAmountsOfToken({ ...quote.buyToken, amount: amountOut });
      const gasCost = gasCalculator.calculateGasCost({ gasEstimation: gasSpent });
      let gas: QuoteResponse['gas'] = undefined;
      if (quote.gas) {
        gas = {
          estimatedGas: gasSpent,
          ...calculateGasDetails(quote.gas.gasTokenSymbol, gasCost['standard'].gasCostNativeToken, quote.gas.gasTokenPrice),
        };
      }
      return { ...quote, sellAmount, buyAmount, gas };
    });
  }

  private async simulate({
    chainId,
    calls,
    account,
    value,
  }: {
    chainId: ChainId;
    account: Address;
    value?: bigint;
    calls: string[];
  }): Promise<ReadonlyArray<SimulationResult>> {
    const { result } = await this.providerService.getViemPublicClient({ chainId }).simulateContract({
      address: this.permit2AdapterContract.address(chainId) as ViemAddress,
      abi: permit2AdapterAbi,
      functionName: 'simulate',
      args: [calls as Hex[]],
      account: account as ViemAddress,
      value: value ?? 0n,
    });
    return result;
  }
}

type SimulationResult = {
  success: boolean;
  result: Hex;
  gasSpent: bigint;
};

function buildRealQuote(
  {
    takerAddress,
    recipient,
    permitData,
    txValidFor,
  }: {
    takerAddress: Address;
    recipient?: Address;
    permitData?: PermitData['permitData'] & { signature: string }; // Not needed in case of native token
    txValidFor?: TimeString;
  },
  quote: EstimatedQuoteResponseWithTx,
  chainId: ChainId
): QuoteResponseWithTx | FailedResponse {
  try {
    recipient = recipient ?? takerAddress;
    const deadline = BigInt(permitData?.deadline ?? calculateDeadline(txValidFor) ?? calculateDeadline('1w'));
    const data =
      quote.type === 'sell'
        ? encodeFunctionData({
            abi: permit2AdapterAbi,
            functionName: 'sellOrderSwap',
            args: [
              {
                deadline,
                tokenIn: mapIfNative(quote.sellToken.address),
                amountIn: BigInt(quote.maxSellAmount.amount),
                nonce: permitData ? BigInt(permitData.nonce) : 0n,
                signature: (permitData?.signature as Hex) ?? '0x',
                allowanceTarget: quote.source.allowanceTarget as ViemAddress,
                swapper: quote.customData.estimatedTx.to as ViemAddress,
                swapData: quote.customData.estimatedTx.data as Hex,
                tokenOut: mapIfNative(quote.buyToken.address),
                minAmountOut: BigInt(quote.minBuyAmount.amount),
                transferOut: [{ recipient: recipient as ViemAddress, shareBps: 0n }],
                misc: '0x',
              },
            ],
          })
        : encodeFunctionData({
            abi: permit2AdapterAbi,
            functionName: 'buyOrderSwap',
            args: [
              {
                deadline,
                tokenIn: mapIfNative(quote.sellToken.address),
                maxAmountIn: BigInt(quote.maxSellAmount.amount),
                nonce: permitData ? BigInt(permitData.nonce) : 0n,
                signature: (permitData?.signature as Hex) ?? '0x',
                allowanceTarget: quote.source.allowanceTarget as ViemAddress,
                swapper: quote.customData.estimatedTx.to as ViemAddress,
                swapData: quote.customData.estimatedTx.data as Hex,
                tokenOut: mapIfNative(quote.buyToken.address),
                amountOut: BigInt(quote.minBuyAmount.amount),
                transferOut: [{ recipient: recipient as ViemAddress, shareBps: 0n }],
                unspentTokenInRecipient: takerAddress as ViemAddress,
                misc: '0x',
              },
            ],
          });
    return {
      ...quote,
      accounts: { takerAddress, recipient },
      tx: {
        ...quote.customData.estimatedTx,
        from: takerAddress,
        to: PERMIT2_ADAPTER_CONTRACT.address(chainId),
        data,
      },
    };
  } catch (e: any) {
    return {
      failed: true,
      source: quote.source,
      error: `Failed to encode params: ${e.message}`,
    };
  }
}

function mapIfNative(token: TokenAddress): ViemAddress {
  return isSameAddress(token, Addresses.NATIVE_TOKEN) ? Addresses.ZERO_ADDRESS : (token as ViemAddress);
}
