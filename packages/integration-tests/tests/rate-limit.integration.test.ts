import { getAnimeById } from '@lightweight-clients/jikan-api-lightweight-client';
import { afterEach, describe, expect, test } from 'vitest'

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
    test('integration with jikan', async () => {
      const callsCount = 10;
      const results: unknown[] = [];
      const rateLimitedCallback = useRateLimit(() => getAnimeById(801), 1000);

      for (let i = 0; i < callsCount; i++) {
        timestamps.push(Date.now());
        const res = await rateLimitedCallback({});
        results.push(res);
      }

      expect(results.length).equal(callsCount);
      for (let i = 0; i < callsCount; i++) {
        console.log(`Checking result #${i}`);
        const res = results[i];
        expect(res).toBeInstanceOf(Object);
        expect(res).toHaveProperty('data');
      }
    }, 20000);
  });
});