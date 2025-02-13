import chai, { expect } from 'chai';
import { then, when } from '@test-utils/bdd';
import { FetchService } from '@services/fetch/fetch-service';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe('Fetch Service', () => {
  when('request timeouts', () => {
    then('error is clear', async () => {
      const service = new FetchService();
      await expect(service.fetch('https://google.com', { timeout: '1' }))
        .to.be.rejectedWith(AggregateError)
        .and.eventually.satisfy((error: AggregateError) => {
          return error.errors.some((error) => error.message.includes('Request to https://google.com timeouted'));
        });
    });
  });
});
