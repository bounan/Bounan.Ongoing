import type { EventBridgeEvent } from 'aws-lambda';

import type { VideoKey } from '../../../../../third-party/common/ts/interfaces';
import { createLogger } from '../../../../../third-party/common/ts/runtime/logger';
import { sendRegisterVideosRequest } from '../../api-clients/animan-client';
import { getEpisodes } from '../../api-clients/loan-api-client';
import { initConfig } from '../../config/config';
import type { AnimeEntity } from '../../models/anime-entity';
import { checkIfCompleted } from '../../shared/helpers/is-completed';
import { deleteAnime, getAll } from './repository';

const logger = createLogger('@app/handlers/on-schedule/handler');

const getNewVideos = async (anime: AnimeEntity): Promise<VideoKey[]> => {
  const loanApiEpisodes = await getEpisodes(anime.myAnimeListId, anime.dub);
  logger.info('Fetched Loan API episodes', { anime, loanApiEpisodes });

  const newVideos = loanApiEpisodes.filter(ep => !anime.episodes.has(ep));
  logger.info('Calculated new videos', { anime, newVideos });

  return newVideos.map(ep => ({
    myAnimeListId: anime.myAnimeListId,
    dub: anime.dub,
    episode: ep,
  }));
}

const registerNewVideos = async (): Promise<void> => {
  const registeredAnimes = await getAll();
  logger.info('Fetched registered animes', { registeredAnimes });

  const newVideos: VideoKey[] = [];
  for (const anime of registeredAnimes) {
    const videos = await getNewVideos(anime);
    newVideos.push(...videos);
  }
  logger.info('Collected new videos', { newVideos });

  logger.info('Videos to register', { newVideos });
  if (newVideos.length === 0) {
    logger.info('No videos to register');
    return;
  }

  await sendRegisterVideosRequest(newVideos);
};

const cleanupCompletedSeries = async (): Promise<void> => {
  const registeredAnimes = await getAll();

  for (const anime of registeredAnimes) {
    const isCompleted = await checkIfCompleted(anime.myAnimeListId, new Date(anime.updatedAt), anime.episodes);
    if (isCompleted) {
      await deleteAnime(anime);
      logger.info('Anime was deleted', { myAnimeListId: anime.myAnimeListId, dub: anime.dub });
    }
  }
}

const process = async (): Promise<void> => {
  logger.info('Processing videos');
  await registerNewVideos();

  logger.info('Cleaning up completed series');
  await cleanupCompletedSeries();
}

export const handler = async (event: EventBridgeEvent<never, never>): Promise<void> => {
  logger.info('Processing event', { event });
  await initConfig();
  await process();
  logger.info('Done');
};
