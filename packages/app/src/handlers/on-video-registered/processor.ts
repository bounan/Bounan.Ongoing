import type { VideoKey, VideoRegisteredNotification } from '../../../../../third-party/common/ts/interfaces';
import { createLogger } from '../../../../../third-party/common/ts/runtime/logger';
import type { AnimeKey } from '../../models/anime-entity';
import { getEpisodes } from '../../shared/repository';
import { addAnime, addEpisodes } from './repository';

const logger = createLogger('@app/handlers/on-video-registered/processor');

const processAnime = async (videos: VideoKey[]): Promise<void> => {
  const animeKey: AnimeKey = videos[0];
  const episodes = new Set(videos.map(x => x.episode));
  logger.info('Resolved anime key and episodes', { animeKey, episodes: [...episodes] });

  const animeEntity = await getEpisodes(animeKey);
  logger.info('Fetched anime episodes', { animeEntity });

  if (!animeEntity) {
    logger.info('Anime not found, adding new record', { animeKey, episodes: [...episodes] });
    await addAnime(animeKey, episodes);
    return;
  }

  const newEpisodes = new Set([...episodes].filter(x => !animeEntity.episodes.has(x)));
  if (newEpisodes.size === 0) {
    logger.info('No episodes to add', { animeKey });
    return;
  }

  logger.info('Anime found, adding episodes', { animeKey, episodes: [...newEpisodes] });
  await addEpisodes(animeKey, newEpisodes);
}

export const process = async (updatingRequests: VideoRegisteredNotification): Promise<void> => {
  logger.info('Processing video registration notification', { updatingRequests });
  if (!updatingRequests.items || updatingRequests.items.length === 0) {
    logger.info('No animes to process');
    return;
  }

  const videoKeys = updatingRequests.items.map(x => x.videoKey);
  const uniqueAnimes = videoKeys
    .filter((value, index, self) =>
      self.findIndex(x => x.myAnimeListId === value.myAnimeListId && x.dub === value.dub) === index);
  logger.info('Resolved animes to process', { uniqueAnimes });

  for (const anime of uniqueAnimes) {
    const videosToProcess = videoKeys.filter(x => x.myAnimeListId === anime.myAnimeListId && x.dub === anime.dub);
    logger.info('Processing videos for anime', { anime, videosToProcess });
    await processAnime(videosToProcess);
    logger.info('Anime processed', { anime });
  }

  logger.info('Animes processed');
}
