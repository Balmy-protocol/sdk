import { ChainId, FieldRequirementOptions, FieldsRequirements, TimeString, TokenAddress } from '@types';
import { CacheConfig, ConcurrentLRUCacheWithContext } from '@shared/concurrent-lru-cache';
import { IMetadataSource, MetadataInput, MetadataResult } from '../types';
import { calculateFieldRequirements, combineSupportInChains } from '@shared/requirements-and-support';

type CacheContext = { timeout?: TimeString } | undefined;
export class CachedMetadataSource<TokenMetadata extends object> implements IMetadataSource<TokenMetadata> {
  private readonly cache: ConcurrentLRUCacheWithContext<CacheContext, TokenInChain, TokenMetadata>;

  constructor(private readonly source: IMetadataSource<TokenMetadata>, config: CacheConfig) {
    this.cache = new ConcurrentLRUCacheWithContext<CacheContext, TokenInChain, TokenMetadata>({
      calculate: (context, tokensInChain) => this.fetchMetadata(tokensInChain, context),
      config,
    });
  }

  async getMetadata<Requirements extends FieldsRequirements<TokenMetadata>>({
    tokens,
    config,
  }: {
    tokens: MetadataInput[];
    config?: { timeout?: TimeString; fields?: Requirements };
  }) {
    const chainIds = [...new Set(tokens.map(({ chainId }) => chainId))];
    const support = combineSupportInChains(chainIds, this.supportedProperties());
    const fieldRequirements = calculateFieldRequirements(support, config?.fields);
    const requiredFields = Object.entries(fieldRequirements)
      .filter(([, requirement]) => requirement === 'required')
      .map(([field]) => field);
    const tokensInChain = addressesToTokensInChain(tokens, requiredFields);
    const result = await this.cache.getOrCalculate({
      context: config,
      keys: tokensInChain,
      timeout: config?.timeout,
    });
    return tokenInChainRecordToChainAndAddress(result) as Record<ChainId, Record<TokenAddress, MetadataResult<TokenMetadata, Requirements>>>;
  }

  supportedProperties() {
    return this.source.supportedProperties();
  }

  private async fetchMetadata(tokensInChain: TokenInChain[], context: CacheContext): Promise<Record<TokenInChain, TokenMetadata>> {
    const { tokens, requiredFields } = tokensInChainToAddresses(tokensInChain);
    const requirements = Object.fromEntries(requiredFields.map((field) => [field, 'required'])) as Partial<
      Record<keyof TokenMetadata, FieldRequirementOptions>
    >;
    // We set the default to best effort here, even if it wasn't set on the original request. The idea is that we try our best to fetch all properties,
    // so that if we have a future request with the same required fields and best effort is set, then we can use the cached values
    const metadata = (await this.source.getMetadata({
      tokens,
      config: { timeout: context?.timeout, fields: { requirements, default: 'best effort' } },
    })) as Record<ChainId, Record<TokenAddress, TokenMetadata>>;
    return chainAndAddressRecordToTokenInChain(metadata, requiredFields);
  }
}

function addressesToTokensInChain(tokens: MetadataInput[], requiredFields: string[]): TokenInChain[] {
  return tokens.map(({ chainId, token }) => toTokenInChain(chainId, token, requiredFields));
}

function tokensInChainToAddresses(tokensInChain: TokenInChain[]): { tokens: MetadataInput[]; requiredFields: string[] } {
  const result: MetadataInput[] = [];
  let requiredFieldsResult: string[] = [];
  for (const tokenInChain of tokensInChain) {
    const { chainId, address, requiredFields } = fromTokenInChain(tokenInChain);
    requiredFieldsResult = requiredFields; // All tokens should have the same required fields
    result.push({ chainId, token: address });
  }
  return { tokens: result, requiredFields: requiredFieldsResult };
}

function tokenInChainRecordToChainAndAddress<TokenMetadata>(
  record: Record<TokenInChain, TokenMetadata>
): Record<ChainId, Record<TokenAddress, TokenMetadata>> {
  const result: Record<ChainId, Record<TokenAddress, TokenMetadata>> = {};
  for (const [tokenInChain, token] of Object.entries(record)) {
    const { chainId, address } = fromTokenInChain(tokenInChain as TokenInChain);
    if (!(chainId in result)) {
      result[chainId] = {};
    }
    result[chainId][address] = token;
  }
  return result;
}

function chainAndAddressRecordToTokenInChain<TokenMetadata>(
  record: Record<ChainId, Record<TokenAddress, TokenMetadata>>,
  requiredFields: string[]
): Record<TokenInChain, TokenMetadata> {
  const entries = Object.entries(record).flatMap(([chainId, record]) =>
    Object.entries(record).map<[TokenInChain, TokenMetadata]>(([address, token]) => [
      toTokenInChain(Number(chainId), address, requiredFields),
      token,
    ])
  );
  return Object.fromEntries(entries);
}

type TokenInChain = `${ChainId}-${TokenAddress}-${string}`;
function toTokenInChain(chainId: ChainId, address: TokenAddress, requiredFields: string[]): TokenInChain {
  return `${chainId}-${address}-${requiredFields.join(',')}`;
}

function fromTokenInChain(tokenInChain: TokenInChain): { chainId: ChainId; address: TokenAddress; requiredFields: string[] } {
  const [chainId, address, requiredFields] = tokenInChain.split('-');
  return {
    chainId: Number(chainId),
    address,
    requiredFields: requiredFields.length > 0 ? requiredFields.split(',') : [],
  };
}
