import { afterEach, describe, expect } from 'vitest';

import type { RegisterVideosRequest } from '../../../third-party/common/ts/interfaces';
import { cache } from '../../../third-party/common/ts/runtime/memorized';
import { handler as onScheduleHandler } from '../../app/src/handlers/on-schedule/handler';
import { handler as onVideoRegisteredHandler } from '../../app/src/handlers/on-video-registered/handler';
import { it } from '../fixtures';
import { makeSnsEvent } from '../tools/payload-generators';

describe('workflow', () => {
  afterEach(() => {
    // The app memorizes Loan API responses; clear it to avoid cross-test and cross-step leakage.
    cache.clear();
  });

  it('runs a full workflow: schedule -> notification -> registration -> schedule -> notification -> registration -> maintenance deletion',
    async ({ table, api, task }) => {
      const anime = {
        animeKey: '777#sub',
        myAnimeListId: 777,
        dub: 'sub',
        episodes: new Set([1, 2]),
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: new Date().toISOString(),
      };

      await table.putRecords(anime);

      const animanRegistry = api.mockLambda<RegisterVideosRequest>(`animan-register-videos-${task.id}`, {});
      api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3]);
      api.mockJikan(anime.myAnimeListId, 24);

      // 1) Scheduler detects episode 3 and sends one notification to Animan.
      await onScheduleHandler({} as never);
      expect(animanRegistry.requests).toHaveLength(1);
      expect(animanRegistry.requests[0]).toEqual({
        items: [{ videoKey: { myAnimeListId: 777, dub: 'sub', episode: 3 } }],
      });

      // 2) Downstream registration event persists episode 3.
      await onVideoRegisteredHandler(makeSnsEvent(animanRegistry.requests[0]));
      const afterFirstRegistration = await table.getAllRecords();
      expect(afterFirstRegistration).toHaveLength(1);
      expect(afterFirstRegistration[0].episodes).toEqual(new Set([1, 2, 3]));

      // Emulate a new scheduler execution with fresh memoized HTTP responses.
      cache.clear();

      // 3) Scheduler sees episode 4 later and sends another notification.
      api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4]);
      await onScheduleHandler({} as never);
      expect(animanRegistry.requests).toHaveLength(2);
      expect(animanRegistry.requests[1]).toEqual({
        items: [{ videoKey: { myAnimeListId: 777, dub: 'sub', episode: 4 } }],
      });

      // 4) Downstream registration event persists episode 4.
      await onVideoRegisteredHandler(makeSnsEvent(animanRegistry.requests[1]));
      const afterSecondRegistration = await table.getAllRecords();
      expect(afterSecondRegistration).toHaveLength(1);
      expect(afterSecondRegistration[0].episodes).toEqual(new Set([1, 2, 3, 4]));

      // Emulate one more scheduler execution.
      cache.clear();

      // 5) Scheduler sees no new episodes.
      api.mockLambda(`loan-api-function-arn-${task.id}`, [1, 2, 3, 4]);

      // Maintenance pass sees anime as complete (expected last episode == observed max).
      api.mockJikan(anime.myAnimeListId, 4);
      await onScheduleHandler({} as never);
      expect(animanRegistry.requests).toHaveLength(2);

      const finalState = await table.getAllRecords();
      expect(finalState).toHaveLength(0);
    });
});



