/*eslint import/no-unresolved: 0 */
import {
  ChimeSDKMediaPipelinesClient,
  CreateMediaConcatenationPipelineCommand,
  CreateMediaConcatenationPipelineCommandInput,
  GetMediaPipelineCommand,
  GetMediaPipelineCommandOutput,
} from '@aws-sdk/client-chime-sdk-media-pipelines';
import { Handler } from 'aws-cdk-lib/aws-lambda';

const chimeSdkMediaPipelinesClient = new ChimeSDKMediaPipelinesClient({
  region: 'us-east-1',
});
var concatBucketArn = process.env.CONCAT_BUCKET_ARN;

interface Detail {
  version: '0';
  eventType: string;
  timestamp: number;
  meetingId: string;
  externalMeetingId: string;
  mediaPipelineId: string;
  mediaRegion: string;
}
interface EventBridge {
  version: '0';
  id: string;
  'detail-type': string;
  source: 'aws.chime';
  account: string;
  time: string;
  region: string;
  resources: [];
  detail: Detail;
}

export const lambdaHandler: Handler = async (
  event: EventBridge,
): Promise<null> => {
  console.info(event);

  switch (event['detail-type']) {
    case 'Chime Media Pipeline State Change':
      if (event.detail.eventType == 'chime:MediaPipelineInProgress') {
        const mediaCapturePipeline = await getMediaPipeline(
          event.detail.mediaPipelineId,
        );
        if (
          mediaCapturePipeline &&
          mediaCapturePipeline.MediaPipeline &&
          mediaCapturePipeline.MediaPipeline.MediaCapturePipeline &&
          mediaCapturePipeline.MediaPipeline.MediaCapturePipeline
            .MediaPipelineArn
        ) {
          await startConcat(
            mediaCapturePipeline.MediaPipeline.MediaCapturePipeline
              .MediaPipelineArn,
          );
        }
      }
  }
  return null;
};

async function getMediaPipeline(mediaPipelineId: string) {
  try {
    const getMediaPipelineResponse: GetMediaPipelineCommandOutput =
      await chimeSdkMediaPipelinesClient.send(
        new GetMediaPipelineCommand({ MediaPipelineId: mediaPipelineId }),
      );
    return getMediaPipelineResponse;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function startConcat(mediaCapturePipelineArn: string) {
  const createConcatPipelineParams: CreateMediaConcatenationPipelineCommandInput =
    {
      Sinks: [
        {
          S3BucketSinkConfiguration: { Destination: concatBucketArn },
          Type: 'S3Bucket',
        },
      ],
      Sources: [
        {
          MediaCapturePipelineSourceConfiguration: {
            ChimeSdkMeetingConfiguration: {
              ArtifactsConfiguration: {
                Audio: { State: 'Enabled' },
                CompositedVideo: { State: 'Enabled' },
                Content: { State: 'Disabled' },
                DataChannel: { State: 'Enabled' },
                MeetingEvents: { State: 'Enabled' },
                TranscriptionMessages: { State: 'Enabled' },
                Video: { State: 'Disabled' },
              },
            },
            MediaPipelineArn: mediaCapturePipelineArn,
          },
          Type: 'MediaCapturePipeline',
        },
      ],
    };
  console.log(JSON.stringify(createConcatPipelineParams));
  try {
    await chimeSdkMediaPipelinesClient.send(
      new CreateMediaConcatenationPipelineCommand(createConcatPipelineParams),
    );
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}
