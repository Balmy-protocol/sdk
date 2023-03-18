import { chainsUnion } from '@chains';
import { ChainId, FieldRequirementOptions, FieldsRequirements, SupportInChain } from '@types';

export function calculateFieldRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  supportRecord: SupportInChain<Values> | undefined,
  requirements: Requirements | undefined
): Record<keyof Values, FieldRequirementOptions> {
  const result = {} as Record<keyof Values, FieldRequirementOptions>;
  const fields = new Set([...Object.keys(supportRecord ?? {}), ...Object.keys(requirements?.requirements ?? {})]) as Set<
    keyof Values | keyof Requirements['requirements']
  >;
  for (const field of fields) {
    // The idea is simple. We will calculate the requirement for each field in the following order:
    // A. What's specified on the requirements record
    // B. If nothing specified, we will look at the default
    // C. If default is not set, then we fallback to 'best effort'
    //
    // Then, once we know the requirement, we look at the support record
    // A. If the requirement is 'can ignore', then we'll set 'can ignore'
    // B. If the support record says it's present, then we will consider the property 'required', since we expect
    //    it to be there
    // C. If none of the above is true, then we simply fallback to the previously calculated requirement

    const requirement = requirements?.requirements?.[field] ?? requirements?.default ?? 'best effort';
    result[field] = requirement === 'can ignore' || supportRecord?.[field] !== 'present' ? requirement : 'required';
  }
  return result;
}

export function combineSourcesSupport<Source, Values extends object>(
  sources: Source[],
  extractSupport: (source: Source) => Record<ChainId, SupportInChain<object>>
): Record<ChainId, SupportInChain<Values>> {
  const allChains = chainsUnion(sources.map((source) => Object.keys(extractSupport(source)).map(Number)));
  const result: Record<ChainId, SupportInChain<Values>> = {};
  for (const chainId of allChains) {
    result[chainId] = combineSourcesSupportInChain(chainId, sources, extractSupport);
  }
  return result;
}

export function combineSourcesSupportInChain<Source, Values extends object>(
  chainId: ChainId,
  sources: Source[],
  extractSupport: (source: Source) => Record<ChainId, SupportInChain<object>>
): SupportInChain<Values> {
  const sourcesInChain = sources.filter((source) => chainId in extractSupport(source));
  const result = { ...extractSupport(sourcesInChain[0])[chainId] };
  for (let i = 1; i < sourcesInChain.length; i++) {
    const sourceSupport = extractSupport(sourcesInChain[i])[chainId];
    const allKeys = [...new Set([...Object.keys(sourceSupport), ...Object.keys(result)])];
    for (const key of allKeys) {
      if ((result as any)[key] !== (sourceSupport as any)[key]) {
        (result as any)[key] = 'optional';
      }
    }
  }
  return result as SupportInChain<Values>;
}

/**
 * The idea here is that we'll fail if a field is specified as required, but it's not support at all
 * If the field is optional at least, then we won't fail
 */
export function validateRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  support: Record<ChainId, SupportInChain<Values>>,
  chains: ChainId[],
  requirements: Requirements | undefined
) {
  if (!requirements) return;

  for (const chainId of chains) {
    const chainSupport = support[chainId];
    if (!couldSupportMeetRequirements(chainSupport, requirements)) {
      throw new Error(`The provided field requirements cannot be met for chain with id ${chainId}`);
    }
  }
}

export function doesResponseMeetRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  response: Values,
  requirements: Requirements | undefined
) {
  const fieldRequirements = calculateFieldRequirements<Values, Requirements>(undefined, requirements);
  for (const field in fieldRequirements) {
    if (fieldRequirements[field] === 'required' && response[field] === undefined) {
      return false;
    }
  }
  return true;
}

export function couldSupportMeetRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  chainSupport: SupportInChain<Values> | undefined,
  requirements: Requirements | undefined
) {
  if (!requirements) return true;
  const fieldRequirements = calculateFieldRequirements(chainSupport, requirements);
  for (const key in fieldRequirements) {
    if (fieldRequirements[key] === 'required' && chainSupport?.[key] !== 'present' && chainSupport?.[key] !== 'optional') {
      return false;
    }
  }
  return true;
}
