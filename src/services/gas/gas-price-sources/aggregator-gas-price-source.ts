import { timeoutPromise } from '@shared/timeouts';
import { filterRejectedResults } from '@shared/utils';
import { AmountOfToken, ChainId, FieldsRequirements, TimeString } from '@types';
import { BigNumber, constants } from 'ethers';
import { EIP1159GasPrice, GasPrice, GasPriceResult, IGasPriceSource, LegacyGasPrice, MergeGasValues } from '../types';
import { isEIP1159Compatible } from '../utils';
import { combineSupportedSpeeds } from './utils';

export type GasPriceAggregationMethod = 'avg' | 'mean' | 'min' | 'max';
export class AggregatorGasPriceSource<Sources extends IGasPriceSource<object>[] | []> implements IGasPriceSource<MergeGasValues<Sources>> {
  constructor(private readonly sources: Sources, private readonly method: GasPriceAggregationMethod) {
    if (sources.length === 0) throw new Error('No sources were specified');
  }

  supportedSpeeds() {
    return combineSupportedSpeeds(this.sources);
  }

  async getGasPrice<Requirements extends FieldsRequirements<MergeGasValues<Sources>>>({
    chainId,
    config,
    context,
  }: {
    chainId: ChainId;
    config?: { fields?: Requirements };
    context?: { timeout?: TimeString };
  }) {
    const sourcesInChain = this.sources.filter((source) => chainId in source.supportedSpeeds());
    if (sourcesInChain.length === 0) throw new Error(`Chain with id ${chainId} not supported`);
    const promises = sourcesInChain.map((source) =>
      timeoutPromise(source.getGasPrice({ chainId, config, context }), context?.timeout, { reduceBy: '100' })
    );
    const results = await filterRejectedResults(promises);
    if (results.length === 0) throw new Error('Failed to calculate gas on all sources');
    const result = this.aggregate(results);
    // TODO: Check that result matches requirements
    return result as GasPriceResult<MergeGasValues<Sources>, Requirements>;
  }

  private aggregate(results: GasPriceResult<object>[]): GasPriceResult<object> {
    const is1559 = shouldUse1559(results);
    if (is1559) {
      const collected = collectBySpeed<EIP1159GasPrice>(results.filter(isEIP1159Compatible));
      return aggregate(true, collected, this.method);
    } else {
      const collected = collectBySpeed<LegacyGasPrice>(results.filter((result) => !isEIP1159Compatible(result)));
      return aggregate(false, collected, this.method);
    }
  }
}

// Will prioritize by amount of speeds supported. If it's the same amount, then we'll prioritize eip1559
function shouldUse1559(results: GasPriceResult<object>[]) {
  const maxSupportedSpeeds = (results: GasPriceResult<object>[]) =>
    results.reduce<number>((accum, curr) => Math.max(accum, Object.keys(curr).length), 0);
  const max1559SupportedSpeeds = maxSupportedSpeeds(results.filter(isEIP1159Compatible));
  const maxLegacySupportedSpeeds = maxSupportedSpeeds(results.filter((result) => !isEIP1159Compatible(result)));
  return max1559SupportedSpeeds >= maxLegacySupportedSpeeds;
}

function collectBySpeed<GasPriceVersion extends GasPrice>(array: GasPriceResult<object>[]) {
  const collected: Record<string, GasPriceVersion[]> = {};
  for (const gasPrice of array) {
    for (const speed in gasPrice) {
      if (!(speed in collected)) collected[speed] = [];
      collected[speed].push((gasPrice as any)[speed]);
    }
  }
  return collected;
}

type CalculateVersion<Is1559 extends boolean> = Is1559 extends true ? EIP1159GasPrice : LegacyGasPrice;
function aggregate<Is1559 extends boolean>(
  is1559: Is1559,
  bySpeed: Record<string, CalculateVersion<Is1559>[]>,
  method: GasPriceAggregationMethod
) {
  const result: Record<any, CalculateVersion<Is1559>> = {};
  for (const speed in bySpeed) {
    result[speed] = aggregateBySpeed<Is1559>(is1559, bySpeed[speed], method) as CalculateVersion<Is1559>;
  }
  return result;
}

function aggregateBySpeed<Is1559 extends boolean>(is1559: Is1559, toAggregate: CalculateVersion<Is1559>[], method: GasPriceAggregationMethod) {
  return is1559 ? aggregate1559(toAggregate as EIP1159GasPrice[], method) : aggregateLegacy(toAggregate as LegacyGasPrice[], method);
}

function aggregate1559(toAggregate: EIP1159GasPrice[], method: GasPriceAggregationMethod) {
  switch (method) {
    case 'avg':
      return avgFor1559(toAggregate);
    case 'mean':
      return meanByProperty(toAggregate, 'maxFeePerGas');
    case 'max':
      return maxByProperty(toAggregate, 'maxFeePerGas');
    case 'min':
      return minByProperty(toAggregate, 'maxFeePerGas');
  }
}

function aggregateLegacy(toAggregate: LegacyGasPrice[], method: GasPriceAggregationMethod) {
  switch (method) {
    case 'avg':
      return avgForLegacy(toAggregate);
    case 'mean':
      return meanByProperty(toAggregate, 'gasPrice');
    case 'max':
      return maxByProperty(toAggregate, 'gasPrice');
    case 'min':
      return minByProperty(toAggregate, 'gasPrice');
  }
}

function avgFor1559(array: EIP1159GasPrice[]): EIP1159GasPrice {
  const avgMaxFeePerGas = averageForProperty<EIP1159GasPrice>(array, 'maxFeePerGas');
  const avgMaxPriorityFeePerGas = averageForProperty<EIP1159GasPrice>(array, 'maxPriorityFeePerGas');
  return { maxFeePerGas: avgMaxFeePerGas, maxPriorityFeePerGas: avgMaxPriorityFeePerGas };
}

function avgForLegacy(array: LegacyGasPrice[]): LegacyGasPrice {
  const avgGasPrice = averageForProperty<LegacyGasPrice>(array, 'gasPrice');
  return { gasPrice: avgGasPrice };
}

function averageForProperty<GasPriceVersion extends GasPrice>(array: GasPriceVersion[], property: keyof GasPriceVersion): AmountOfToken {
  const sum = array.map((element) => element[property] as AmountOfToken).reduce((accum, curr) => accum.add(curr), constants.Zero);
  return sum.div(array.length).toString();
}

function meanByProperty<GasPriceVersion extends GasPrice>(array: GasPriceVersion[], property: keyof GasPriceVersion): GasPriceVersion {
  const sorted = array.sort((a, b) => (BigNumber.from(a[property]).lte(b[property] as AmountOfToken) ? -1 : 1));
  return sorted[Math.floor(sorted.length / 2)];
}

function maxByProperty<GasPriceVersion extends GasPrice>(array: GasPriceVersion[], property: keyof GasPriceVersion): GasPriceVersion {
  return array.reduce((accum, curr) => (BigNumber.from(accum[property]).gte(curr[property] as AmountOfToken) ? accum : curr));
}

function minByProperty<GasPriceVersion extends GasPrice>(array: GasPriceVersion[], property: keyof GasPriceVersion): GasPriceVersion {
  return array.reduce((accum, curr) => (BigNumber.from(accum[property]).lte(curr[property] as AmountOfToken) ? accum : curr));
}
