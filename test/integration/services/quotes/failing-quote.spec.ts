import ms from 'ms';
import { expect } from 'chai';
import { given, then, when } from '@test-utils/bdd';
import { Chains } from '@chains';
import { QuoteResponse } from '@services/quotes/types';
import { buildSDK } from '@builder';
import { CONFIG } from './quote-tests-config';
import { FailedQuote } from '@services/quotes';
import { ChainId, DefaultRequirements, FieldsRequirements, TimeString, TokenAddress } from '@types';
import { IMetadataSource, MetadataResult } from '@services/metadata';
import { parseEther } from 'viem';

jest.setTimeout(ms('1m'));

type TokenMetadata = { symbol: string; decimals: number };
const MOCKED_METADATA_SOURCE: IMetadataSource<TokenMetadata> = {
  supportedProperties: () => ({ [Chains.ETHEREUM.chainId]: { symbol: 'present', decimals: 'present' } }),
  getMetadata: <Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>({
    addresses,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { fields?: Requirements; timeout?: TimeString };
  }) => {
    const result: Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata, Requirements>>> = {};
    for (const [chainId, tokens] of Object.entries(addresses)) {
      result[Number(chainId)] = Object.fromEntries(
        tokens.map((token) => [token, { symbol: 'SYM', decimals: 18 } as MetadataResult<TokenMetadata, Requirements>])
      );
    }
    return Promise.resolve(result);
  },
};

const { quoteService } = buildSDK({
  metadata: { source: { type: 'custom', instance: MOCKED_METADATA_SOURCE } },
  quotes: { sourceList: { type: 'local' }, defaultConfig: CONFIG },
});

describe('Failing Quote', () => {
  when('executing a quote with invalid tokens', () => {
    let responses: (QuoteResponse | FailedQuote)[];
    given(async () => {
      responses = await quoteService.getAllQuotes({
        request: {
          chainId: Chains.ETHEREUM.chainId,
          sellToken: '0x0000000000000000000000000000000000000000',
          buyToken: '0x0000000000000000000000000000000000000001',
          order: {
            type: 'sell',
            sellAmount: parseEther('1'),
          },
          slippagePercentage: 3,
          takerAddress: '0x0000000000000000000000000000000000000002',
        },
        config: {
          timeout: '10s',
          ignoredFailed: false,
        },
      });
    });
    then('all quotes fail', () => {
      for (const response of responses) {
        expect('failed' in response, `Expected ${(response as QuoteResponse).source?.name} to fail, but it didn't`).to.be.true;
      }
    });
  });
});
