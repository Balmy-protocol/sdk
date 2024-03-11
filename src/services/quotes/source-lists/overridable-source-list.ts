import { SourceId } from '../types';
import { IQuoteSourceList, SourceListRequest, SourceListResponse, MultipleSourceListRequest } from './types';

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

  getQuotes(request: MultipleSourceListRequest): Promise<SourceListResponse>[] {
    const defaultSourcesId = [];
    const result: Promise<SourceListResponse>[] = [];
    for (const sourceId of request.sources) {
      if (!this.hasOverrideSourceList(sourceId)) {
        defaultSourcesId.push(sourceId);
      } else {
        result.push(...this.getSourceListForId(sourceId).getQuotes({ ...request, sources: [sourceId] }));
      }
    }
    result.push(...this.defaultSourceList.getQuotes({ ...request, sources: defaultSourcesId }));
    return result;
  }

  private getSourceListForId(sourceId: SourceId) {
    return this.overrides[sourceId] ?? this.defaultSourceList;
  }

  private hasOverrideSourceList(sourceId: SourceId): boolean {
    return !!this.overrides[sourceId];
  }
}
