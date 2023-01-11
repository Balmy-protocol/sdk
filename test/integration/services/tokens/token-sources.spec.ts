import ms from 'ms';
import { expect } from 'chai';
import crossFetch from 'cross-fetch';
import { ProviderTokenSource } from '@services/tokens/token-sources/provider';
import { DefiLlamaToken, DefiLlamaTokenSource } from '@services/tokens/token-sources/defi-llama';
import { FallbackTokenSource } from '@services/tokens/token-sources/fallback-token-source';
import { MulticallService } from '@services/multicall/multicall-service';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicProvidersSource } from '@services/providers/provider-sources/public-providers';
import { BaseToken, ITokenSource } from '@services/tokens/types';
import { Networks } from '@networks';
import { Addresses } from '@shared/constants';
import { ChainId, Network, TokenAddress } from '@types';

const TESTS: Record<ChainId, { address: TokenAddress; symbol: string; decimals: number }> = {
  [Networks.OPTIMISM.chainId]: { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', symbol: 'DAI', decimals: 18 },
  [Networks.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC', decimals: 6 },
  [Networks.ARBITRUM.chainId]: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX', decimals: 18 },
  [Networks.BNB_CHAIN.chainId]: { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'Cake', decimals: 18 },
  [Networks.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', decimals: 8 },
};

const PROVIDER_TOKEN_SOURCE = new ProviderTokenSource(new MulticallService(new PublicProvidersSource()));
const DEFI_LLAMA_TOKEN_SOURCE = new DefiLlamaTokenSource(new FetchService(crossFetch));
const FALLBACK_TOKEN_SOURCE = new FallbackTokenSource<Partial<DefiLlamaToken> & BaseToken>([PROVIDER_TOKEN_SOURCE, DEFI_LLAMA_TOKEN_SOURCE]);

jest.setTimeout(ms('1m'));

describe('Token Sources', () => {
  tokenSourceTest({ title: 'Provider Source', source: PROVIDER_TOKEN_SOURCE });
  tokenSourceTest({ title: 'Defi Llama Source', source: DEFI_LLAMA_TOKEN_SOURCE, validate: { fieldsExist: ['price', 'timestamp'] } });
  tokenSourceTest({
    title: 'Fallback Source',
    source: FALLBACK_TOKEN_SOURCE,
    validate: { fieldsExist: ['price', 'timestamp'], on: DEFI_LLAMA_TOKEN_SOURCE.supportedNetworks() },
  });

  function tokenSourceTest<T extends BaseToken>({
    title,
    source,
    validate,
  }: {
    title: string;
    source: ITokenSource<T>;
    validate?: { fieldsExist: (keyof T & string)[]; on?: Network[] };
  }) {
    describe(title, () => {
      let input: Record<ChainId, TokenAddress[]>;
      let result: Record<ChainId, Record<TokenAddress, T>>;
      beforeAll(async () => {
        const networks = source.supportedNetworks();
        const entries = networks.map<[ChainId, TokenAddress[]]>(({ chainId }) => {
          const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
          if (chainId in TESTS) addresses.push(TESTS[chainId].address);
          return [chainId, addresses];
        });
        input = Object.fromEntries(entries);
        result = await source.getTokens(input);
      });

      test(`Returned amount of chains is as expected`, () => {
        expect(Object.keys(result)).to.have.lengthOf(source.supportedNetworks().length);
      });

      for (const network of source.supportedNetworks()) {
        describe(network.name, () => {
          test(`Returned amount of tokens is as expected`, () => {
            expect(Object.keys(result[network.chainId])).to.have.lengthOf(input[network.chainId].length);
          });
          test(`${network.currencySymbol}`, () => {
            validateToken({ network, address: Addresses.NATIVE_TOKEN, symbol: network.currencySymbol, decimals: 18 });
          });
          if (network.chainId in TESTS) {
            test(`${TESTS[network.chainId].symbol}`, () => {
              validateToken({ network, ...TESTS[network.chainId] });
            });
          }
        });
      }

      function validateToken({
        network,
        address,
        symbol,
        decimals,
      }: {
        network: Network;
        address: TokenAddress;
        symbol: string;
        decimals: number;
      }) {
        const token = result[network.chainId][address];
        expect(token.address).to.equal(address);
        expect(token.decimals).to.equal(decimals);
        expect(token.symbol).to.equal(symbol);
        if (validate && (!validate.on || validate.on.some(({ chainId }) => network.chainId === chainId))) {
          for (const field of validate.fieldsExist) {
            expect(token).to.have.property(field);
          }
        }
      }
    });
  }
});
