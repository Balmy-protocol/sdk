import { chainsUnion } from '@chains';
import { ChainId, FieldRequirementOptions, FieldsRequirements, SupportInChain } from '@types';

export function calculateFieldRequirementsPerChain<Values extends object, Requirements extends FieldsRequirements<Values>>(
  supportRecord: Record<ChainId, SupportInChain<Values>>,
  requirements: Requirements | undefined
) {
  const result: Record<ChainId, Record<keyof Values, FieldRequirementOptions>> = {};
  for (const chainId in supportRecord) {
    result[chainId] = calculateFieldRequirements(supportRecord[chainId], requirements);
  }
  return result;
}

export function calculateFieldRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  supportRecord: SupportInChain<Values> | undefined,
  requirements: Requirements | undefined
): Record<keyof Values, FieldRequirementOptions> {
  const result = {} as Record<keyof Values, FieldRequirementOptions>;
  const fields = new Set([...Object.keys(supportRecord ?? {}), ...Object.keys(requirements?.requirements ?? {})]) as Set<keyof Values>;
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
    const supports: SupportInChain<object>[] = sources.map((source) => extractSupport(source)[chainId]).filter((support) => !!support);
    result[chainId] = combineSupportRecords(supports);
  }
  return result;
}

export function combineSupportInChains<Values extends object>(
  chainIds: ChainId[],
  support: Record<ChainId, SupportInChain<object>>
): SupportInChain<Values> {
  const supportsInChains = chainIds.map((chainId) => support[chainId]).filter((support) => !!support);
  return combineSupportRecords(supportsInChains);
}

export function combineSupportRecords<Values extends object>(supports: SupportInChain<object>[]): SupportInChain<Values> {
  const result = supports[0];
  for (let i = 1; i < supports.length; i++) {
    const sourceSupport = supports[i];
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

  const supportRecord = combineSupportInChains(chains, support);
  if (!couldSupportMeetRequirements(supportRecord, requirements)) {
    throw new Error(`The provided field requirements cannot be met for all chains`);
  }
}

export function doesResponseMeetRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  response: Values | undefined,
  requirements: Requirements | undefined
) {
  const fieldRequirements = calculateFieldRequirements<Values, Requirements>(undefined, requirements);
  for (const field in fieldRequirements) {
    if (fieldRequirements[field] === 'required' && !(field in (response ?? {}))) {
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

export function makeRequirementsCompatible<Values extends object, Requirements extends FieldsRequirements<Values> | undefined>(
  supportRecord: Record<ChainId, SupportInChain<Values>>,
  chains: ChainId[],
  requirements: Requirements
): Requirements {
  if (!requirements) return requirements;
  const newRequirements: Partial<Record<keyof Values, FieldRequirementOptions>> = {};
  const isPropertyPresentOrOptionalInAllChains = (field: keyof Values) => chains.every((chainId) => !!supportRecord[chainId]?.[field]);

  for (const field in requirements.requirements) {
    if (requirements.requirements[field] !== 'required' || isPropertyPresentOrOptionalInAllChains(field)) {
      newRequirements[field] = requirements.requirements[field];
    }
  }

  return { requirements: newRequirements, default: requirements.default } as Requirements;
}
