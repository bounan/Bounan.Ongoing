import { makeLambdaRequest } from '../../../../third-party/common/ts/runtime/lambda-client';
import { asyncMemoized } from '../../../../third-party/common/ts/runtime/memorized';
import { config } from '../config/config';

type GetEpisodesRequest = { myAnimeListId: number; dub: string };
type GetEpisodesResponse = number[];

const getEpisodesInternal = (myAnimeListId: number, dub: string): Promise<GetEpisodesResponse> => {
  return makeLambdaRequest<GetEpisodesRequest, GetEpisodesResponse>(config.value.loanApiConfig.functionArn, {
    myAnimeListId,
    dub,
  });
};

export const getEpisodes = asyncMemoized('getEpisodes', getEpisodesInternal);
