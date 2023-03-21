import { ChainId, SupportInChain, TimeString, TokenAddress } from '@types';
import { timeoutPromise } from '@shared/timeouts';
import { IMetadataSource, MergeMetadata } from '../types';
import { combineSourcesSupport } from '@shared/requirements-and-support';

// This fallback source will use different sources and combine the results of each of them
export class FallbackMetadataSource<Sources extends IMetadataSource<object>[] | []> implements IMetadataSource<MergeMetadata<Sources>> {
  constructor(private readonly sources: Sources) {
    if (sources.length === 0) throw new Error('Need at least one source to setup a fallback token source');
  }

  getMetadata({ addresses, config }: { addresses: Record<ChainId, TokenAddress[]>; config?: { timeout?: TimeString } }) {
    return new Promise<Record<ChainId, Record<TokenAddress, MergeMetadata<Sources>>>>((resolve, reject) => {
      const result: Record<ChainId, Record<TokenAddress, MergeMetadata<Sources>>> = {};
      const propertiesCounter = this.buildPropertiesCounter(addresses);

      let sourcesLeftToFulfil = this.sources.length;
      let successfulRequests = 0;

      const handleFulfil = (source: IMetadataSource<object>) => {
        this.updatePropertiesCounterWhenSourceFulfilled(propertiesCounter, source, addresses);

        if (--sourcesLeftToFulfil === 0 || Object.keys(propertiesCounter).length === 0) {
          if (successfulRequests > 0) {
            resolve(result);
          } else {
            reject(new Error('Could not find tokens for the given addresses'));
          }
        }
      };

      this.sources.forEach(async (source) => {
        const addressesForSource = getAddressesForSource(source, addresses);
        if (Object.keys(addressesForSource).length === 0) {
          // If there is nothing to query for this source, exit
          handleFulfil(source);
          return;
        }

        timeoutPromise(source.getMetadata({ addresses: addressesForSource }), config?.timeout, { reduceBy: '100' })
          .then((sourceResult) => {
            successfulRequests++;
            for (const [chainIdString, metadataRecord] of Object.entries(sourceResult)) {
              const chainId = parseInt(chainIdString);
              const metadatas = Object.entries(metadataRecord);
              if (!(chainId in result) && metadatas.length > 0) result[chainId] = {};

              for (const [address, metadata] of metadatas) {
                // Add to result
                result[chainId][address] = { ...result[chainId][address], ...metadata };

                // Remove from counter
                for (const tokenProperty in metadata) {
                  const property = tokenProperty as keyof MergeMetadata<Sources>;
                  delete propertiesCounter?.[chainId]?.[address]?.[property];
                }
              }
            }
          })
          .catch(() => {}) // Handle, but do nothing
          .finally(() => handleFulfil(source));
      });
    });
  }

  supportedProperties(): Record<ChainId, SupportInChain<MergeMetadata<Sources>>> {
    return combineSourcesSupport<IMetadataSource<object>, MergeMetadata<Sources>>(this.sources, (source) => source.supportedProperties());
  }

  private buildPropertiesCounter(addresses: Record<ChainId, TokenAddress[]>) {
    const propertiesCounter: Record<ChainId, Record<TokenAddress, Record<keyof MergeMetadata<Sources>, number>>> = {};
    for (const chainId in addresses) {
      const counter: Record<keyof MergeMetadata<Sources>, number> = {} as any;
      for (const source of this.sources) {
        const supportedProperties = source.supportedProperties();
        if (chainId in supportedProperties) {
          for (const tokenProperty in supportedProperties[chainId]) {
            const property = tokenProperty as keyof MergeMetadata<Sources>;
            counter[property] = (counter[property] ?? 0) + 1;
          }
        }
      }
      propertiesCounter[chainId] = {};
      for (const tokenAddress of addresses[chainId]) {
        propertiesCounter[chainId][tokenAddress] = { ...counter };
      }
    }
    return propertiesCounter;
  }

  private updatePropertiesCounterWhenSourceFulfilled(
    propertiesCounter: Record<ChainId, Record<TokenAddress, Record<keyof MergeMetadata<Sources>, number>>>,
    source: IMetadataSource<object>,
    addresses: Record<ChainId, TokenAddress[]>
  ) {
    const supportedProperties = source.supportedProperties();
    const addressesForSource = getAddressesForSource(source, addresses);
    for (const [chainIdString, addresses] of Object.entries(addressesForSource)) {
      const chainId = parseInt(chainIdString);
      for (const address of addresses) {
        for (const tokenProperty in supportedProperties[chainId]) {
          const property = tokenProperty as keyof MergeMetadata<Sources>;
          const counter = propertiesCounter[chainId]?.[address]?.[property];
          if (counter !== undefined) {
            if (counter === 1) {
              delete propertiesCounter[chainId][address][property];
            } else {
              propertiesCounter[chainId][address][property] = counter - 1;
            }
          }
        }
        if (
          chainId in propertiesCounter &&
          address in propertiesCounter[chainId] &&
          Object.keys(propertiesCounter[chainId][address]).length === 0
        ) {
          delete propertiesCounter[chainId][address];
        }
      }
      if (chainId in propertiesCounter && Object.keys(propertiesCounter[chainId]).length === 0) {
        delete propertiesCounter[chainId];
      }
    }
  }
}

function getAddressesForSource<TokenData extends object>(
  source: IMetadataSource<TokenData>,
  addresses: Record<ChainId, TokenAddress[]>
): Record<ChainId, TokenAddress[]> {
  const chainsForSource = new Set(Object.keys(source.supportedProperties()));
  const filteredEntries = Object.entries(addresses)
    .filter(([chainId]) => chainsForSource.has(chainId))
    .map<[ChainId, TokenAddress[]]>(([chainId, addresses]) => [parseInt(chainId), addresses]);
  return Object.fromEntries(filteredEntries);
}
