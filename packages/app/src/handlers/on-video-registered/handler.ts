import type { SNSEvent } from 'aws-lambda';

import { createLogger } from '../../../../../third-party/common/ts/runtime/logger';
import { retry } from '../../../../../third-party/common/ts/runtime/retry';
import { initConfig } from '../../config/config';
import { process } from './processor';

const logger = createLogger('@app/handlers/on-video-registered/handler');

const processMessage = async (message: string): Promise<void> => {
  logger.info('Processing message', { message });

  const updatingRequest = JSON.parse(message);
  await process(updatingRequest);

  logger.info('Message processed');
};

export const handler = async (event: SNSEvent): Promise<void> => {
  logger.info('Processing event', { event });
  await initConfig();
  for (const record of event.Records) {
    logger.info('Processing record', { messageId: record?.Sns?.MessageId });
    await retry(async () => await processMessage(record.Sns.Message), 3, () => true);
  }

  logger.info('Done');
};
