import type { VideoRegisteredNotification } from '../../../third-party/common/ts/interfaces';
import { createLogger } from '../../../third-party/common/ts/runtime/logger';
import { handler as onSchedule } from './handlers/on-schedule/handler';
import { handler as videoRegistered } from './handlers/on-video-registered/handler';

const logger = createLogger('@app/local-runner');

const onRegistered = async (message: VideoRegisteredNotification) => {
  logger.info('Processing message', { message });

  // @ts-expect-error - we don't need to provide all the event properties
  await videoRegistered({ Records: [{ Sns: { Message: JSON.stringify(message) } }] });

  logger.info('Message processed');
}

const main = async () => {
  const animes: [number, string][] = [
    [59730, 'РуАниме / DEEP'],
    [801, 'MC Entertainment'],
  ]

  logger.info('Test: Episodes should be registered on the first run');
  await onRegistered({
    items: [
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 1,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 2,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 3,
        },
      },
    ],
  });
  logger.warn('Expected: 3 episodes registered');

  logger.info('Test: Episodes should not be registered twice');
  await onRegistered({
    items: [
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 2,
        },
      },
    ],
  });
  logger.warn('Expected: No episodes registered');

  logger.info('Test: Only new episodes should be registered');
  await onRegistered({
    items: [
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 2,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 3,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 4,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 5,
        },
      },
    ],
  });
  logger.warn('Expected: 4&5 episodes registered');

  logger.info('Test: Different titles should be registered separately');
  await onRegistered({
    items: [
      {
        videoKey: {
          myAnimeListId: animes[1][0],
          dub: animes[1][1],
          episode: 1,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[0][0],
          dub: animes[0][1],
          episode: 2,
        },
      },
      {
        videoKey: {
          myAnimeListId: animes[1][0],
          dub: animes[1][1],
          episode: 3,
        },
      },
    ],
  });
  logger.warn('Expected: 2 episodes registered for 1st title, 1 episode for 2nd title');

  logger.info('Test: When we add last episode, the anime should be deleted');
  await onRegistered({
    items: Array.from({ length: 24 }, (_, i) => ({
      videoKey: {
        myAnimeListId: animes[0][0],
        dub: animes[0][1],
        episode: i + 1,
      },
    })),
  });
  logger.warn('Expected: Anime deleted');

  logger.info('Test: On Schedule');
  await onSchedule({} as never);
  logger.warn('Expected: No errors');
}

main();
