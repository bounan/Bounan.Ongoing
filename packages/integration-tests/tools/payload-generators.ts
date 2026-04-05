import type { SNSEvent, SNSEventRecord, SNSMessage } from 'aws-lambda';

export const makeSnsEvent = (message: unknown): SNSEvent => {
  return {
    Records: [
      {
        Sns: {
          MessageId: 'test-message-id',
          Message: JSON.stringify(message),
        } as unknown as SNSMessage,
      } as unknown as SNSEventRecord,
    ],
  };
}
