import { getAnimeById } from '@lightweight-clients/jikan-api-lightweight-client';

import { config } from '../../config/config';
import { useRateLimit } from './rate-limit';

const getAnimeByIdRateLimited = useRateLimit(getAnimeById, 1000);

const tryGetAnimeById = async (myAnimeListId: number): Promise<ReturnType<typeof getAnimeById> | null> => {
  try {
    return await getAnimeByIdRateLimited(myAnimeListId);
  } catch (error) {
    console.error('Failed to get anime info: ', error);
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
    console.log('Anime outdated: ', outdatedDate, lastUpdate, isOutdated);
    return true;
  }

  const animeInfo = await tryGetAnimeById(myAnimeListId);
  console.log('Anime info: ', animeInfo);
  if (!animeInfo) {
    console.warn('Failed to get anime info.');
    return false;
  }

  const expectedLastEpisode: number | undefined | null = animeInfo?.data?.episodes;
  console.log('Expected last episode: ', expectedLastEpisode);
  if (!expectedLastEpisode) {
    // If an expected last episode is not defined, it is probably a movie or a single episode anime.
    // Anyway, it worth leaving it in the db for a while, as it can be a mistake.
    console.warn('Expected last episode is not defined.');
    return false;
  }

  const observedLastEpisode = Math.max(...allEpisodes);
  console.log('Observed last episode: ', observedLastEpisode);

  const result = expectedLastEpisode <= observedLastEpisode
    || (expectedLastEpisode === 1 && observedLastEpisode === 0); // Movie or single episode anime.
  console.log('Anime completed check result: ', result);

  return result;
}
