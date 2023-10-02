import { DCAService } from '@services/dca/dca-service';
import { IFetchService } from '@services/fetch';
import { IMulticallService } from '@services/multicall';
import { IPermit2Service } from '@services/permit2';
import { IQuoteService } from '@services/quotes';

export type BuildDCAParams = { customAPIUrl?: string };
type Dependencies = {
  multicallService: IMulticallService;
  permit2Service: IPermit2Service;
  quoteService: IQuoteService;
  fetchService: IFetchService;
};
export function buildDCAService(
  params: BuildDCAParams | undefined,
  { multicallService, permit2Service, quoteService, fetchService }: Dependencies
) {
  return new DCAService(params?.customAPIUrl ?? 'https://api.balmy.xyz', multicallService, permit2Service, quoteService, fetchService);
}
