import { DCAService } from '@services/dca/dca-service';
import { IFetchService } from '@services/fetch';
import { IPermit2Service } from '@services/permit2';
import { IPriceService } from '@services/prices';
import { IProviderService } from '@services/providers';
import { IQuoteService } from '@services/quotes';

export type BuildDCAParams = { customAPIUrl?: string };
type Dependencies = {
  providerService: IProviderService;
  permit2Service: IPermit2Service;
  quoteService: IQuoteService;
  fetchService: IFetchService;
  priceService: IPriceService;
};
export function buildDCAService(
  params: BuildDCAParams | undefined,
  { providerService, permit2Service, quoteService, fetchService, priceService }: Dependencies
) {
  return new DCAService(
    params?.customAPIUrl ?? 'https://api.balmy.xyz',
    providerService,
    permit2Service,
    quoteService,
    fetchService,
    priceService
  );
}
