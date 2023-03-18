import { timeoutPromise } from '@shared/timeouts';
import { FailedQuote, QuoteResponse, SourceId } from '../types';
import { IQuoteSourceList, SourceListRequest } from './types';

type ConstructorParameters = {
  default: IQuoteSourceList;
  overrides: { list: IQuoteSourceList; sourceIds: SourceId[] }[];
};
export class OverridableSourceList implements IQuoteSourceList {
  private readonly overrides: Record<SourceId, IQuoteSourceList>;
  private readonly defaultSourceList: IQuoteSourceList;

  constructor({ default: defaultSourceList, overrides }: ConstructorParameters) {
    this.defaultSourceList = defaultSourceList;
    this.overrides = {};
    for (const { list, sourceIds } of overrides) {
      for (const sourceId of sourceIds) {
        if (sourceId in this.overrides) {
          throw new Error(`Source with id ${sourceId} was assigned twice`);
        }
        this.overrides[sourceId] = list;
      }
    }
  }

  supportedSources() {
    const sources = this.defaultSourceList.supportedSources();
    for (const [sourceId, sourceList] of Object.entries(this.overrides)) {
      sources[sourceId] = sourceList.supportedSources()[sourceId];
    }
    return sources;
  }

  getQuotes(request: SourceListRequest): Promise<QuoteResponse | FailedQuote>[] {
    const requests = this.getRequests(request.sourceIds);
    return requests
      .flatMap(({ sourceList, sourceIds }) => sourceList.getQuotes({ ...request, sourceIds }))
      .map((promise) => timeoutPromise(promise, request.quoteTimeout));
  }

  private getRequests(sourceIds: SourceId[]) {
    const result: Map<IQuoteSourceList, SourceId[]> = new Map();
    for (const sourceId of sourceIds) {
      const source = this.getSourceListForId(sourceId);
      if (result.has(source)) {
        result.get(source)!.push(sourceId);
      } else {
        result.set(source, [sourceId]);
      }
    }
    return [...result.entries()].map(([sourceList, sourceIds]) => ({ sourceList, sourceIds }));
  }

  private getSourceListForId(sourceId: SourceId) {
    return this.overrides[sourceId] ?? this.defaultSourceList;
  }
}
