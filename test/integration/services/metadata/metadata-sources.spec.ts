import ms from 'ms';
import { expect } from 'chai';
import { ProviderService } from '@services/providers/provider-service';
import { RPCMetadataSource } from '@services/metadata/metadata-sources/rpc-metadata-source';
import { DefiLlamaMetadataSource } from '@services/metadata/metadata-sources/defi-llama-metadata-source';
import { PortalsFiMetadataSource } from '@services/metadata/metadata-sources/portals-fi-metadata-source';
import { FallbackMetadataSource } from '@services/metadata/metadata-sources/fallback-metadata-source';
import { MulticallService } from '@services/multicall/multicall-service';
import { FetchService } from '@services/fetch/fetch-service';
import { PublicRPCsSource } from '@services/providers/provider-sources/public-providers';
import { Chains, getChainByKey } from '@chains';
import { Addresses } from '@shared/constants';
import { ChainId, TokenAddress } from '@types';
import { IMetadataSource, MetadataResult } from '@services/metadata';
import { CachedMetadataSource } from '@services/metadata/metadata-sources/cached-metadata-source';
import { ChangellyMetadataSource } from '@services/metadata/metadata-sources/changelly-metadata-source';

const TESTS: Record<ChainId, { address: TokenAddress; symbol: string }> = {
  [Chains.OPTIMISM.chainId]: { address: '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', symbol: 'DAI' },
  [Chains.POLYGON.chainId]: { address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', symbol: 'USDC' },
  [Chains.ARBITRUM.chainId]: { address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', symbol: 'GMX' },
  [Chains.BNB_CHAIN.chainId]: { address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82', symbol: 'Cake' },
  [Chains.ETHEREUM.chainId]: { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC' },
};

const FETCH_SERVICE = new FetchService();
const PROVIDER_SERVICE = new ProviderService(new PublicRPCsSource());
const RPC_METADATA_SOURCE = new RPCMetadataSource(new MulticallService(PROVIDER_SERVICE));
const DEFI_LLAMA_METADATA_SOURCE = new DefiLlamaMetadataSource(FETCH_SERVICE);
const PORTALS_FI_METADATA_SOURCE = new PortalsFiMetadataSource(FETCH_SERVICE);
const FALLBACK_METADATA_SOURCE = new FallbackMetadataSource([RPC_METADATA_SOURCE, DEFI_LLAMA_METADATA_SOURCE]);
const CACHED_METADATA_SOURCE = new CachedMetadataSource(DEFI_LLAMA_METADATA_SOURCE, {
  expiration: {
    useCachedValue: 'always',
    useCachedValueIfCalculationFailed: 'always',
  },
  maxSize: 100,
});
const CHANGELLY_METADATA_SOURCE = new ChangellyMetadataSource(FETCH_SERVICE, process.env.CHANGELLY_API_KEY!);

jest.retryTimes(2);
jest.setTimeout(ms('1m'));

describe('Metadata Sources', () => {
  metadataSourceTest({
    title: 'RPC Source',
    source: RPC_METADATA_SOURCE,
    fields: [{ fields: ['decimals', 'symbol', 'name'], on: 'all chains' }],
  });
  metadataSourceTest({
    title: 'Portals Fi Source',
    source: PORTALS_FI_METADATA_SOURCE,
    fields: [{ fields: ['decimals', 'symbol', 'name'], on: 'all chains' }],
  });
  metadataSourceTest({
    title: 'Defi Llama Source',
    source: DEFI_LLAMA_METADATA_SOURCE,
    fields: [{ fields: ['decimals', 'symbol'], on: 'all chains' }],
  });
  metadataSourceTest({
    title: 'Fallback Source',
    source: FALLBACK_METADATA_SOURCE,
    fields: [
      { fields: ['decimals', 'symbol'], on: 'all chains' },
      { fields: ['name'], on: chainsForSource(RPC_METADATA_SOURCE) },
    ],
  });
  metadataSourceTest({
    title: 'Cached Source',
    source: CACHED_METADATA_SOURCE,
    fields: [{ fields: ['decimals', 'symbol'], on: 'all chains' }],
  });
  // metadataSourceTest({
  //   title: 'Changelly Source',
  //   source: CHANGELLY_METADATA_SOURCE,
  //   fields: [{ fields: ['decimals', 'symbol', 'name'], on: 'all chains' }],
  // }); We comment this out because we need an API key

  function metadataSourceTest<TokenMetadata extends object>({
    title,
    source,
    fields,
  }: {
    title: string;
    source: IMetadataSource<TokenMetadata>;
    fields: { fields: (keyof TokenMetadata)[]; on: 'all chains' | ChainId[] }[];
  }) {
    describe(title, () => {
      describe('supportedProperties', () => {
        it('Supported properties are reported correctly', () => {
          const supportedProperties = source.supportedProperties();
          for (const chainIdString in supportedProperties) {
            const chainId = Number(chainIdString);
            const fieldsThatApply = fields.filter(({ on }) => appliesToChain(on, chainId));
            const totalAmountExpected = fieldsThatApply.reduce((accum, { fields }) => fields.length + accum, 0);
            expect(Object.keys(supportedProperties[chainId])).to.have.lengthOf(totalAmountExpected);
            for (const { fields: fieldsExist } of fieldsThatApply) {
              expect(supportedProperties[chainId]).to.include.all.keys(fieldsExist);
            }
          }
        });

        function appliesToChain(on: 'all chains' | ChainId[], chain: ChainId) {
          return on === 'all chains' || on.includes(chain);
        }
      });

      describe('getMetadata', () => {
        let input: Record<ChainId, TokenAddress[]>;
        let result: Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata>>>;
        beforeAll(async () => {
          const chains = Object.keys(source.supportedProperties()).map(Number);
          const entries = chains.map<[ChainId, TokenAddress[]]>((chainId) => {
            const addresses: TokenAddress[] = [Addresses.NATIVE_TOKEN];
            if (chainId in TESTS) addresses.push(TESTS[chainId].address);
            return [chainId, addresses];
          });
          input = Object.fromEntries(entries);
          result = await source.getMetadata({ addresses: input, config: { timeout: '30s' } });
        });

        test(`Returned amount of chains is as expected`, () => {
          expect(Object.keys(result)).to.have.lengthOf(Object.keys(source.supportedProperties()).length);
        });

        for (const chainIdString in source.supportedProperties()) {
          const chainId = Number(chainIdString);
          const chain = getChainByKey(chainId);
          describe(chain?.name ?? `Chain with id ${chainId}`, () => {
            test(`Returned amount of tokens is as expected`, () => {
              expect(Object.keys(result[chainId])).to.have.lengthOf(input[chainId].length);
            });
            test(chain?.nativeCurrency?.symbol ?? 'Native token', () => {
              validateMetadata({ chainId, address: Addresses.NATIVE_TOKEN });
            });
            if (chainId in TESTS) {
              test(`${TESTS[chainId].symbol}`, () => {
                validateMetadata({ chainId, ...TESTS[chainId] });
              });
            }
          });
        }

        function validateMetadata({ chainId, address }: { chainId: ChainId; address: TokenAddress }) {
          const token = result[chainId][address];
          for (const { fields: fieldsExist, on } of fields) {
            if (on !== 'all chains' && !on.includes(chainId)) continue;
            for (const field of fieldsExist) {
              expect(token).to.have.property(field as any);
            }
          }
        }
      });
    });
  }
});
function chainsForSource(source: IMetadataSource<object>) {
  return Object.keys(source.supportedProperties()).map(Number);
}
