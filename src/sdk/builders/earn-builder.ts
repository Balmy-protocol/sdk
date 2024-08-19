import { EarnService } from '@services/earn/earn-service';
import { IPermit2Service } from '@services/permit2';
import { IQuoteService } from '@services/quotes';

type Dependencies = {
  permit2Service: IPermit2Service;
  quoteService: IQuoteService;
};
export function buildEarnService({ permit2Service, quoteService }: Dependencies) {
  return new EarnService(permit2Service, quoteService);
}
