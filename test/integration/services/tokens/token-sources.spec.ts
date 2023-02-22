import ms from 'ms';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { RPCTokenSource } from '@services/tokens/token-sources/rpc-token-source';
import { DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { MulticallService } from '@services/multicall/multicall-service';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { ITokenSource } from '@services/tokens/types';
import { Chains, getChainByKey } from '@chains';
import { Addresses } from '@shared/constants';
import { ChainId, TokenAddress } from '@types';

const TESTS: Record<ChainId, { address: TokenAddress; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', symbol: 'DAI' },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX' },
  [Chains.BNB_CHAIN.chainId]: { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'Cake' },
  [Chains.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC' },
};

const RPC_TOKEN_SOURCE = new RPCTokenSource(new MulticallService(new PublicRPCsSource()));
const DEFI_LLAMA_TOKEN_SOURCE = new DefiLlamaTokenSource(new FetchService(crossFetch));
const FALLBACK_TOKEN_SOURCE = new FallbackTokenSource([RPC_TOKEN_SOURCE, DEFI_LLAMA_TOKEN_SOURCE]);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Token Sources', () => {
  tokenSourceTest({
    title: 'Provider Source',
    source: RPC_TOKEN_SOURCE,
    validate: [{ fieldsExist: ['decimals', 'symbol'], on: 'all chains' }],
  });
  tokenSourceTest({
    title: 'Defi Llama Source',
    source: DEFI_LLAMA_TOKEN_SOURCE,
    validate: [{ fieldsExist: ['decimals', 'symbol', 'price'], on: 'all chains' }],
  });
  tokenSourceTest({
    title: 'Fallback Source',
    source: FALLBACK_TOKEN_SOURCE,
    validate: [
      { fieldsExist: ['decimals', 'symbol'], on: 'all chains' },
      { fieldsExist: ['price'], on: Object.keys(DEFI_LLAMA_TOKEN_SOURCE.tokenProperties()).map(Number) },
    ],
  });

  function tokenSourceTest<TokenData>({
    title,
    source,
    validate,
  }: {
    title: string;
    source: ITokenSource<TokenData>;
    validate: { fieldsExist: (keyof TokenData & string)[]; on: 'all chains' | ChainId[] }[];
  }) {
    describe(title, () => {
      let input: Record<ChainId, TokenAddress[]>;
      let result: Record<ChainId, Record<TokenAddress, TokenData>>;
      beforeAll(async () => {
        const chains = Object.keys(source.tokenProperties()).map(Number);
        const entries = chains.map<[ChainId, TokenAddress[]]>((chainId) => {
          const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
          if (chainId in TESTS) addresses.push(TESTS[chainId].address);
          return [chainId, addresses];
        });
        input = Object.fromEntries(entries);
        result = await source.getTokens({ addresses: input, context: { timeout: '30s' } });
      });

      test(`Returned amount of chains is as expected`, () => {
        expect(Object.keys(result)).to.have.lengthOf(Object.keys(source.tokenProperties()).length);
      });

      for (const chainIdString in source.tokenProperties()) {
        const chainId = Number(chainIdString);
        const chain = getChainByKey(chainId);
        describe(chain?.name ?? `Chain with id ${chainId}`, () => {
          test(`Returned amount of tokens is as expected`, () => {
            expect(Object.keys(result[chainId])).to.have.lengthOf(input[chainId].length);
          });
          test(chain?.currencySymbol ?? 'Native token', () => {
            validateToken({ chainId, address: Addresses.NATIVE_TOKEN });
          });
          if (chainId in TESTS) {
            test(`${TESTS[chainId].symbol}`, () => {
              validateToken({ chainId, ...TESTS[chainId] });
            });
          }
        });
      }

      function validateToken({ chainId, address }: { chainId: ChainId; address: TokenAddress }) {
        const token = result[chainId][address];
        for (const { fieldsExist, on } of validate) {
          if (on !== 'all chains' && !on.includes(chainId)) continue;
          for (const field of fieldsExist) {
            expect(token).to.have.property(field);
          }
        }
      }
    });
  }
});
