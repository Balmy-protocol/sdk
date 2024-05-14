import { doesResponseMeetRequirements, validateRequirements } from '@shared/requirements-and-support';
import { timeoutPromise } from '@shared/timeouts';
import { ChainId, DefaultRequirements, FieldsRequirements, TimeString, TokenAddress } from '@types';
import { IMetadataService, IMetadataSource, MetadataInput } from './types';

export class MetadataService<TokenMetadata extends object> implements IMetadataService<TokenMetadata> {
  constructor(private readonly metadataSource: IMetadataSource<TokenMetadata>) {}

  supportedChains(): ChainId[] {
    return Object.keys(this.supportedProperties()).map(Number);
  }

  supportedProperties() {
    return this.metadataSource.supportedProperties();
  }

  async getMetadataInChain<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>({
    chainId,
    tokens,
    config,
  }: {
    chainId: ChainId;
    tokens: TokenAddress[];
    config?: { fields?: Requirements; timeout?: TimeString };
  }) {
    const result = await this.getMetadata({ tokens: tokens.map((token) => ({ chainId, token })), config });
    return result[chainId] ?? {};
  }

  async getMetadata<Requirements extends FieldsRequirements<TokenMetadata> = DefaultRequirements<TokenMetadata>>({
    tokens,
    config,
  }: {
    tokens: MetadataInput[];
    config?: { fields?: Requirements; timeout?: TimeString };
  }) {
    if (tokens.length === 0) return {};
    const chains = [...new Set(tokens.map(({ chainId }) => chainId))];
    validateRequirements(this.supportedProperties(), chains, config?.fields);
    const response = await timeoutPromise(this.metadataSource.getMetadata({ tokens, config }), config?.timeout);
    validateResponse(tokens, response, config?.fields);
    return response;
  }
}

function validateResponse<Values extends object, Requirements extends FieldsRequirements<Values>>(
  request: MetadataInput[],
  response: Record<ChainId, Record<TokenAddress, Values>>,
  requirements: Requirements | undefined
) {
  for (const { chainId, token } of request) {
    if (!doesResponseMeetRequirements(response[chainId]?.[token], requirements)) {
      throw new Error('Failed to fetch metadata that meets the given requirements');
    }
  }
}
