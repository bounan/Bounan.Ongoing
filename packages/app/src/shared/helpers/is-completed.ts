import { getAnimeById } from '@lightweight-clients/jikan-api-lightweight-client';

import { createLogger } from '../../../../../third-party/common/ts/runtime/logger';
import { config } from '../../config/config';
import { useRateLimit } from './rate-limit';

const getAnimeByIdRateLimited = useRateLimit(getAnimeById, 1000);
const logger = createLogger('@app/shared/helpers/is-completed');

const tryGetAnimeById = async (myAnimeListId: number): Promise<ReturnType<typeof getAnimeById> | null> => {
  try {
    return await getAnimeByIdRateLimited(myAnimeListId);
  } catch (error) {
    logger.error('Failed to get anime info', error, { myAnimeListId });
    return null;
  }
}

// Assumption: episodes can be started from any number, but they are always in order.
// Say, if episode 12 is released, then all existing previous episodes are released as well.
export const checkIfCompleted = async (
  myAnimeListId: number,
  lastUpdate: Date,
  allEpisodes: Set<number>,
): Promise<boolean> => {
  const outdatedDate = new Date(new Date().getTime() - config.value.processing.outdatedPeriodHours * 60 * 60 * 1000);
  const isOutdated = lastUpdate < outdatedDate;
  if (isOutdated) {
    logger.info('Anime is outdated', { myAnimeListId, outdatedDate, lastUpdate, isOutdated });
    return true;
  }

  const animeInfo = await tryGetAnimeById(myAnimeListId);
  logger.info('Fetched anime info', { myAnimeListId, animeInfo });
  if (!animeInfo) {
    logger.warn('Failed to get anime info', { myAnimeListId });
    return false;
  }

  const expectedLastEpisode: number | undefined | null = animeInfo?.data?.episodes;
  logger.info('Resolved expected last episode', { myAnimeListId, expectedLastEpisode });
  if (!expectedLastEpisode) {
    // If an expected last episode is not defined, it is probably a movie or a single episode anime.
    // Anyway, it worth leaving it in the db for a while, as it can be a mistake.
    logger.warn('Expected last episode is not defined', { myAnimeListId });
    return false;
  }

  const observedLastEpisode = Math.max(...allEpisodes);
  logger.info('Resolved observed last episode', { myAnimeListId, observedLastEpisode });

  const result = expectedLastEpisode <= observedLastEpisode
    || (expectedLastEpisode === 1 && observedLastEpisode === 0); // Movie or single episode anime.
  logger.info('Calculated anime completed check result', {
    myAnimeListId,
    expectedLastEpisode,
    observedLastEpisode,
    result,
  });

  return result;
}
