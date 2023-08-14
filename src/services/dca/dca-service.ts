import { IMulticallService } from '@services/multicall';
import { DCAPositionManagementService } from './position-management-service';
import { IDCAPositionManagementService, IDCAService } from './types';
import { IPermit2Service } from '@services/permit2';
import { IQuoteService } from '@services/quotes';

export class DCAService implements IDCAService {
  readonly management: IDCAPositionManagementService;

  constructor(multicallService: IMulticallService, permit2Service: IPermit2Service, quoteService: IQuoteService) {
    this.management = new DCAPositionManagementService(multicallService, permit2Service, quoteService);
  }
}
