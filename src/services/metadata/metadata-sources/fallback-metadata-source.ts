import { ChainId, FieldRequirementOptions, FieldsRequirements, TimeString, TokenAddress } from '@types';
import { reduceTimeout, timeoutPromise } from '@shared/timeouts';
import { IMetadataSource, MergeMetadata, MetadataResult } from '../types';
import { calculateFieldRequirementsPerChain, combineSourcesSupport, makeRequirementsCompatible } from '@shared/requirements-and-support';

// This fallback source will use different sources and combine the results of each of them
export class FallbackMetadataSource<Sources extends IMetadataSource<object>[] | []> implements IMetadataSource<MergeMetadata<Sources>> {
  constructor(private readonly sources: Sources) {
    if (sources.length === 0) throw new Error('Need at least one source to setup a fallback token source');
  }

  // @ts-ignore Will get 'Return type annotation circularly references itself' if not ignored
  getMetadata<Requirements extends FieldsRequirements<MergeMetadata<Sources>>>({
    addresses,
    config,
  }: {
    addresses: Record<ChainId, TokenAddress[]>;
    config?: { fields?: Requirements; timeout?: TimeString };
  }) {
    return new Promise<Record<ChainId, Record<TokenAddress, MetadataResult<MergeMetadata<Sources>, Requirements>>>>((resolve, reject) => {
      const chainsInRequest = Object.keys(addresses).map(Number);
      const sources = this.sources.filter((source) => doesSourceSupportAtLeastOneChain(source, chainsInRequest)) as Sources;
      if (sources.length === 0) {
        reject(new Error(`Couldn't find sources that supported the given chains`));
      }

      const result: Record<ChainId, Record<TokenAddress, MetadataResult<MergeMetadata<Sources>, Requirements>>> = {};
      const requirements = calculateFieldRequirementsPerChain(this.supportedProperties(), config?.fields);
      const requestTracker = buildRequestTracker(sources, addresses, requirements);

      const handleFulfil = (source: IMetadataSource<object>) => {
        updateCounterWhenSourceFulfilled(source, requestTracker);
        const status = checkStatus(requestTracker);
        if (status === 'finished') {
          resolve(result);
        } else if (status === 'error') {
          reject(new Error('Could not find metadata for the given addresses'));
        }
      };

      sources.forEach(async (source) => {
        const addressesForSource = getAddressesForSource(source, addresses);
        const reducedTimeout = reduceTimeout(config?.timeout, '100');
        try {
          // Some requirements might not be compatible with all sources, so we need to filter them before
          // passing them to the source. This is so that the underlying source doesn't fail
          const filteredRequirements = makeRequirementsCompatible(
            source.supportedProperties(),
            Object.keys(addressesForSource).map(Number),
            config?.fields
          );
          const sourceResult = await timeoutPromise(
            source.getMetadata({
              addresses: addressesForSource,
              config: { timeout: reducedTimeout, fields: filteredRequirements },
            }),
            reducedTimeout
          );
          for (const [chainIdString, metadataRecord] of Object.entries(sourceResult)) {
            const chainId = Number(chainIdString);
            const metadatas = Object.entries(metadataRecord);
            if (!(chainId in result) && metadatas.length > 0) result[chainId] = {};

            for (const [address, metadata] of metadatas) {
              // Add to result
              result[chainId][address] = { ...result[chainId][address], ...metadata };

              // Remove token address from counter
              for (const tokenProperty in metadata) {
                const property = tokenProperty as keyof MergeMetadata<Sources>;
                requestTracker?.[chainId]?.[property]?.tokens?.delete(address);
              }
            }
          }
        } catch {
          // Handle, but do nothing
        } finally {
          handleFulfil(source);
        }
      });
    });
  }

  // @ts-ignore Will get 'Return type annotation circularly references itself' if not ignored
  supportedProperties() {
    return combineSourcesSupport<IMetadataSource<object>, MergeMetadata<Sources>>(this.sources, (source) => source.supportedProperties());
  }
}

function buildRequestTracker<Sources extends IMetadataSource<object>[] | []>(
  sources: Sources,
  addresses: Record<ChainId, TokenAddress[]>,
  fieldRequirements: RequestRequirements<Sources>
) {
  const requestTracker: RequestTracker<Sources> = {};
  for (const chainId in addresses) {
    const addressesInChain = addresses[chainId];
    requestTracker[chainId] = Object.fromEntries(
      Object.entries(fieldRequirements[chainId]).map(([property, requirement]) => [
        property,
        { sources: 0, tokens: new Set(addressesInChain), requirement },
      ])
    ) as Record<keyof MergeMetadata<Sources>, TrackInfo>;

    for (const source of sources) {
      const supportedProperties = source.supportedProperties();
      if (chainId in supportedProperties) {
        for (const property in supportedProperties[chainId]) {
          requestTracker[chainId][property as keyof MergeMetadata<Sources>].sources += 1;
        }
      }
    }
  }
  return requestTracker;
}

function updateCounterWhenSourceFulfilled<Sources extends IMetadataSource<object>[] | []>(
  source: IMetadataSource<object>,
  requestTracker: RequestTracker<Sources>
) {
  const supportedProperties = source.supportedProperties();
  for (const [chainId, properties] of Object.entries(supportedProperties)) {
    if (chainId in requestTracker) {
      for (const property in properties) {
        requestTracker[Number(chainId)][property as keyof MergeMetadata<Sources>].sources -= 1;
      }
    }
  }
}

function checkStatus<Sources extends IMetadataSource<object>[] | []>(requestTracker: RequestTracker<Sources>) {
  let result: 'continue' | 'finished' | 'error' = 'finished';
  for (const chainId in requestTracker) {
    for (const { sources, tokens, requirement } of Object.values<TrackInfo>(requestTracker[chainId])) {
      if (sources === 0 && tokens.size > 0 && requirement === 'required') {
        return 'error';
      } else if (sources > 0 && tokens.size > 0 && requirement !== 'can ignore') {
        result = 'continue';
      }
    }
  }
  return result;
}

function getAddressesForSource<TokenMetadata extends object>(
  source: IMetadataSource<TokenMetadata>,
  addresses: Record<ChainId, TokenAddress[]>
): Record<ChainId, TokenAddress[]> {
  const chainsForSource = new Set(Object.keys(source.supportedProperties()));
  const filteredEntries = Object.entries(addresses)
    .filter(([chainId]) => chainsForSource.has(chainId))
    .map<[ChainId, TokenAddress[]]>(([chainId, addresses]) => [Number(chainId), addresses]);
  return Object.fromEntries(filteredEntries);
}

function doesSourceSupportAtLeastOneChain(source: IMetadataSource<object>, chainIds: ChainId[]) {
  return Object.keys(source.supportedProperties())
    .map(Number)
    .some((chainId) => chainIds.includes(chainId));
}

type PropertyRecord<Sources extends IMetadataSource<object>[] | [], T> = Record<ChainId, Record<keyof MergeMetadata<Sources>, T>>;
type TrackInfo = { sources: number; tokens: Set<TokenAddress>; requirement: FieldRequirementOptions };
type RequestRequirements<Sources extends IMetadataSource<object>[] | []> = PropertyRecord<Sources, FieldRequirementOptions>;
type RequestTracker<Sources extends IMetadataSource<object>[] | []> = PropertyRecord<Sources, TrackInfo>;
