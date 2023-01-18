import { AVAILABLE_GAS_SPEEDS, IGasPriceSource, MergeGasSpeedSupportRecord } from '../types';

export function combineSupportedSpeeds<Sources extends IGasPriceSource<any>[] | []>(sources: Sources): MergeGasSpeedSupportRecord<Sources> {
  const result = sources[0].supportedSpeeds();
  for (let i = 1; i < sources.length; i++) {
    const sourceSpeeds = sources[i].supportedSpeeds();
    for (const speed of AVAILABLE_GAS_SPEEDS) {
      if (result[speed] !== sourceSpeeds[speed]) {
        result[speed] = 'optional';
      }
    }
  }
  return result;
}
