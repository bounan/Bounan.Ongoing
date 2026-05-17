import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';

import type { RegisterVideosRequest, VideoKey } from '../../../../third-party/common/ts/interfaces';
import { createLogger } from '../../../../third-party/common/ts/runtime/logger';
import { config } from '../config/config';

const lambdaClient = new LambdaClient({});
const logger = createLogger('@app/api-clients/animan-client');

export const sendRegisterVideosRequest = async (videoKeys: VideoKey[]): Promise<void> => {
  logger.info('Sending register videos request', { videoKeys });

  const request: RegisterVideosRequest = {
    items: videoKeys.map(videoKey => ({ videoKey })),
  };

  const message = JSON.stringify(request);
  logger.info('Sending request', { message });

  const result = await lambdaClient.send(new InvokeCommand({
    FunctionName: config.value.animan.registerVideosLambdaName,
    Payload: message,
  }));
  logger.info('Request sent', { result });
}
