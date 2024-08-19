import { EarnService } from '@services/earn/earn-service';
import { IPermit2Service } from '@services/permit2';
import { IProviderService } from '@services/providers';
import { IQuoteService } from '@services/quotes';

type Dependencies = {
  permit2Service: IPermit2Service;
  quoteService: IQuoteService;
  providerService: IProviderService;
};
export function buildEarnService({ permit2Service, quoteService, providerService }: Dependencies) {
  return new EarnService(permit2Service, quoteService, providerService);
}
