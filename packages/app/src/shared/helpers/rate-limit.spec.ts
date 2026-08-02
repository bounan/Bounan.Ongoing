import { afterEach, describe, expect, test } from 'vitest';

import { useRateLimit } from './rate-limit';

describe('useRateLimit', () => {
  const args: number[] = [];
  const timestamps: number[] = [];

  afterEach(() => {
    console.log('Timestamps:');
    console.log(`0: ${timestamps[0]} => ${args[0]}`);
    for (let i = 1; i < timestamps.length; i++) {
      console.log(`${i}: ${timestamps[i]} (+ ${timestamps[i] - timestamps[i - 1]} ms) => ${args[i]}`);
    }

    args.length = 0;
    timestamps.length = 0;
  });

  const callbackStub = (i: number): Promise<1> => {
    args.push(i);
    timestamps.push(Date.now());
    return Promise.resolve(1);
  };

  describe('unit tests', () => {
    test('should call the callback immediately if within rate limit', async () => {
      const startTime = Date.now();
      const rateLimitedCallback = useRateLimit(callbackStub, 1000);

      await rateLimitedCallback(0);

      expect(timestamps.length).to.equal(1);
      expect(timestamps[0]).closeTo(startTime, 50); // Allow a small margin for execution time
    });

    test('should delay calls to respect the rate limit', { retry: 2 }, async () => {
      const callsCount = 10;

      const rateLimitedCallback = useRateLimit(callbackStub, 333);

      for (let i = 0; i < callsCount; i++) {
        await rateLimitedCallback(i);
      }

      expect(timestamps.length).to.equal(callsCount);
      for (let i = 1; i < timestamps.length; i++) {
        const timeDiff = timestamps[i] - timestamps[i - 1];
        expect(timeDiff).to.be.greaterThanOrEqual(333);
        expect(timeDiff).to.be.lessThan(333 + 100);
      }
    });

    test('should handle multiple calls correctly', async () => {
      const rateLimitedCallback = useRateLimit(callbackStub, 0);
      await rateLimitedCallback(1);
      await rateLimitedCallback(2);
      await rateLimitedCallback(3);
      await rateLimitedCallback(4);

      expect(args.length).equal(4);
      expect(args[0]).equal(1);
      expect(args[1]).equal(2);
      expect(args[2]).equal(3);
      expect(args[3]).equal(4);
    });
  });
});
