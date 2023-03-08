import { FieldRequirementOptions, FieldsRequirements, SupportInChain } from '@types';

export function calculateFieldRequirements<Values extends object, Requirements extends FieldsRequirements<Values>>(
  supportRecord: SupportInChain<Values>,
  requirements: Requirements | undefined
): Record<keyof Values, FieldRequirementOptions> {
  const result = {} as Record<keyof Values, FieldRequirementOptions>;
  for (const speed in supportRecord ?? {}) {
    // The idea is simple. If the support record says that the speed is present, then it should always be present, and we can
    // mark is as required. If it's optional, then we look at the requirements. If not set, we fallback to the default. And if
    // that isn't set, then we go with best effort
    result[speed] =
      supportRecord[speed] === 'present' ? 'required' : requirements?.requirements?.[speed] ?? requirements?.default ?? 'best effort';
  }
  return result;
}
