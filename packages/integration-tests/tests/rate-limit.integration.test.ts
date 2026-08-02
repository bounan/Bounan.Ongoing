import { animes, client_setUserAgent } from '@lightweight-clients/shikimori-graphql-api-lightweight-client';
import { afterEach, describe, expect, test } from 'vitest';

import { useRateLimit } from '../../app/src/shared/helpers/rate-limit';

describe('useRateLimit', () => {
  const timestamps: number[] = [];

  afterEach(() => {
    console.log('Timestamps:');
    console.log(`0: ${timestamps[0]}`);
    for (let i = 1; i < timestamps.length; i++) {
      console.log(`${i}: ${timestamps[i]} (+ ${timestamps[i] - timestamps[i - 1]} ms)`);
    }

    timestamps.length = 0;
  });

  describe('integration tests', () => {
    test('integration with Shikimori', async () => {
      client_setUserAgent('Bounan.Ongoing');
      const callsCount = 10;
      const results: { episodes: number }[][] = [];
      const rateLimitedCallback = useRateLimit(() => animes({ ids: '801', limit: 1 }, { episodes: 1 }), 1000);

      for (let i = 0; i < callsCount; i++) {
        timestamps.push(Date.now());
        results.push(await rateLimitedCallback({}));
      }

      expect(results).toHaveLength(callsCount);
      for (let i = 0; i < callsCount; i++) {
        console.log(`Checking result #${i}`);
        expect(results[i]).toHaveLength(1);
        expect(results[i][0].episodes).toBeTypeOf('number');
      }
    }, 20000);
  });
});
