import { QuoteResponseRelevant, QuoteTransaction, SourceId } from '../types';
import { IQuoteSourceList, SourceListBuildTxRequest, SourceListQuoteRequest, SourceListQuoteResponse } from './types';

type ConstructorParameters = {
  default: IQuoteSourceList;
  overrides: {
    getQuotes?: { list: IQuoteSourceList; sourceIds: SourceId[] }[];
    buildTxs?: { list: IQuoteSourceList; sourceIds: SourceId[] }[];
  };
};
export class OverridableSourceList implements IQuoteSourceList {
  private readonly getQuotesOverrides: Record<SourceId, IQuoteSourceList> = {};
  private readonly buildTxsOverrides: Record<SourceId, IQuoteSourceList> = {};
  private readonly defaultSourceList: IQuoteSourceList;

  constructor({ default: defaultSourceList, overrides }: ConstructorParameters) {
    this.defaultSourceList = defaultSourceList;
    for (const { list, sourceIds } of overrides.getQuotes ?? []) {
      for (const sourceId of sourceIds) {
        if (sourceId in this.getQuotesOverrides) {
          throw new Error(`Source with id ${sourceId} was assigned twice`);
        }
        this.getQuotesOverrides[sourceId] = list;
      }
    }
    for (const { list, sourceIds } of overrides.buildTxs ?? []) {
      for (const sourceId of sourceIds) {
        if (sourceId in this.buildTxsOverrides) {
          throw new Error(`Source with id ${sourceId} was assigned twice`);
        }
        this.buildTxsOverrides[sourceId] = list;
      }
    }
  }

  supportedSources() {
    const sources = this.defaultSourceList.supportedSources();
    for (const [sourceId, sourceList] of Object.entries(this.getQuotesOverrides)) {
      sources[sourceId] = sourceList.supportedSources()[sourceId];
    }
    for (const [sourceId, sourceList] of Object.entries(this.buildTxsOverrides)) {
      sources[sourceId] = sourceList.supportedSources()[sourceId];
    }
    return sources;
  }

  getQuotes(request: SourceListQuoteRequest): Record<SourceId, Promise<SourceListQuoteResponse>> {
    const result: Record<SourceId, Promise<SourceListQuoteResponse>> = {};
    const sourceListSourcesId: Map<IQuoteSourceList, SourceId[]> = new Map();

    request.sources.forEach((sourceId) => {
      const sourceList = this.getQuotesOverrides[sourceId] ?? this.defaultSourceList;
      if (!sourceListSourcesId.has(sourceList)) {
        sourceListSourcesId.set(sourceList, []);
      }
      sourceListSourcesId.get(sourceList)!.push(sourceId);
    });

    sourceListSourcesId.forEach((sourceIds, sourceList) => {
      const responses = sourceList.getQuotes({ ...request, sources: sourceIds });
      Object.entries(responses).forEach(([sourceId, response]) => (result[sourceId] = response));
    });

    return result;
  }

  buildTxs(request: SourceListBuildTxRequest): Record<SourceId, Promise<QuoteTransaction>> {
    const result: Record<SourceId, Promise<QuoteTransaction>> = {};
    const sourceListSourcesId: Map<IQuoteSourceList, Record<SourceId, Promise<QuoteResponseRelevant>>> = new Map();

    Object.entries(request.quotes).forEach(([sourceId, quote]) => {
      const sourceList = this.buildTxsOverrides[sourceId] ?? this.defaultSourceList;
      if (!sourceListSourcesId.has(sourceList)) {
        sourceListSourcesId.set(sourceList, {});
      }
      sourceListSourcesId.get(sourceList)![sourceId] = quote;
    });

    sourceListSourcesId.forEach((quotes, sourceList) => {
      const responses = sourceList.buildTxs({ ...request, quotes });
      Object.entries(responses).forEach(([sourceId, response]) => (result[sourceId] = response));
    });

    return result;
  }
}
