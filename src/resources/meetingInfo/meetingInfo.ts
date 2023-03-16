/*eslint import/no-unresolved: 0 */
import { randomUUID } from 'crypto';
import {
  ChimeSDKMediaPipelinesClient,
  CreateMediaCapturePipelineCommand,
  CreateMediaCapturePipelineCommandInput,
  CreateMediaCapturePipelineCommandOutput,
} from '@aws-sdk/client-chime-sdk-media-pipelines';
import {
  ChimeSDKMeetingsClient,
  DeleteMeetingCommand,
  CreateAttendeeCommand,
  CreateMeetingCommand,
  CreateMeetingCommandOutput,
  CreateMeetingCommandInput,
  CreateAttendeeCommandInput,
  CreateAttendeeCommandOutput,
  GetMeetingCommand,
  StartMeetingTranscriptionCommand,
  Attendee,
  Meeting,
  DeleteMeetingCommandOutput,
} from '@aws-sdk/client-chime-sdk-meetings';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  PutCommandOutput,
  ScanCommandInput,
  ScanCommandOutput,
  DeleteCommand,
  DeleteCommandInput,
  DeleteCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const marshallOptions = {
  convertEmptyValues: false,
  removeUndefinedValues: true,
  convertClassInstanceToMap: false,
};
const unmarshallOptions = {
  wrapNumbers: false,
};
const translateConfig = { marshallOptions, unmarshallOptions };
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient, translateConfig);

const chimeSdkMeetings = new ChimeSDKMeetingsClient({
  region: 'us-east-1',
});

const chimeSdkMediaPipelinesClient = new ChimeSDKMediaPipelinesClient({
  region: 'us-east-1',
});

var meetingInfoTable = process.env.MEETINGS_TABLE;
var outputTable = process.env.OUTPUT_TABLE;
var captureBucketArn = process.env.CAPTURE_BUCKET_ARN;
var awsAccountId = process.env.AWS_ACCOUNT_ID;

interface JoinInfo {
  Meeting: Meeting;
  Attendee: Array<Attendee>;
}

var response: APIGatewayProxyResult = {
  statusCode: 200,
  body: '',
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  },
};

var createMeetingCommandInput: CreateMeetingCommandInput = {
  ClientRequestToken: '',
  ExternalMeetingId: '',
  MediaRegion: 'us-east-1',
};

var createAttendeeCommandInput: CreateAttendeeCommandInput = {
  MeetingId: '',
  ExternalUserId: '',
};

export const lambdaHandler = async (
  event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
  console.info(event);

  switch (event.path) {
    case '/meeting':
      return meetingRequest(event);
    case '/end':
      return endRequest(event);
    case '/recordings':
      return recordingsRequest();
    default:
      return response;
  }
};

async function recordingsRequest() {
  const scanOutputTable: ScanCommandInput = {
    TableName: outputTable,
  };
  try {
    const data: ScanCommandOutput = await ddbDocClient.send(
      new ScanCommand(scanOutputTable),
    );
    console.log(data);
    response.body = JSON.stringify(data.Items);
    response.statusCode = 200;
    return response;
  } catch (err) {
    console.log(err);
    response.body = JSON.stringify('No recordings found');
    response.statusCode = 404;
    return response;
  }
}

async function endRequest(event: APIGatewayEvent) {
  if (event.body) {
    const body = JSON.parse(event.body);
    const deleteMeetingResponse: DeleteMeetingCommandOutput =
      await chimeSdkMeetings.send(
        new DeleteMeetingCommand({ MeetingId: body.meetingId }),
      );
    console.log(JSON.stringify(deleteMeetingResponse));
    const deleteCommandParams: DeleteCommandInput = {
      TableName: meetingInfoTable,
      Key: { meetingId: body.meetingId },
    };
    console.log(deleteCommandParams);
    const deleteItemResponse: DeleteCommandOutput = await ddbDocClient.send(
      new DeleteCommand(deleteCommandParams),
    );
    console.log(JSON.stringify(deleteItemResponse));

    response.body = JSON.stringify('Meeting Deleted');
    response.statusCode = 200;
    return response;
  } else {
    response.body = JSON.stringify('Meeting not found');
    response.statusCode = 404;
    return response;
  }
}

async function meetingRequest(event: APIGatewayEvent) {
  const currentMeetings = await checkForMeetings();

  if (event.body) {
    const body = JSON.parse(event.body);
    const attendeeEmail = body.email;
    if (currentMeetings) {
      for (let meeting of currentMeetings) {
        try {
          await chimeSdkMeetings.send(
            new GetMeetingCommand({ MeetingId: meeting.meetingId }),
          );
          console.log('Adding an attendee to an existing meeting');
          console.log(JSON.stringify(meeting.joinInfo));
          const attendeeInfo = await createAttendee(
            meeting.meetingId,
            attendeeEmail,
          );
          console.log(`attendeeInfo: ${JSON.stringify(attendeeInfo)}`);
          meeting.joinInfo.Attendee.push(attendeeInfo.Attendee);
          console.log(JSON.stringify(meeting.joinInfo));
          await putMeetingInfo(meeting.joinInfo);

          const responseInfo = {
            Meeting: meeting.joinInfo.Meeting,
            Attendee: attendeeInfo.Attendee,
          };

          response.statusCode = 200;
          response.body = JSON.stringify(responseInfo);
          console.info('joinInfo: ' + JSON.stringify(response));
          return response;
        } catch (err) {
          console.log(`Error: ${err}`);
          continue;
        }
      }
    }

    const meetingInfo = await createMeeting();
    if (meetingInfo && meetingInfo.Meeting && meetingInfo.Meeting.MeetingId) {
      const attendeeInfo: CreateAttendeeCommandOutput = await createAttendee(
        meetingInfo.Meeting.MeetingId,
        attendeeEmail,
      );
      let joinInfo: JoinInfo;
      if (attendeeInfo && attendeeInfo.Attendee) {
        joinInfo = {
          Meeting: meetingInfo.Meeting,
          Attendee: [attendeeInfo.Attendee],
        };
        const responseInfo = {
          Meeting: meetingInfo.Meeting,
          Attendee: attendeeInfo.Attendee,
        };

        await startTranscribe(meetingInfo.Meeting.MeetingId);
        const mediaCapturePipelineArn = await startCapture(
          meetingInfo.Meeting.MeetingId,
        );
        if (mediaCapturePipelineArn) {
          await putMeetingInfo(joinInfo);
          response.statusCode = 200;
          response.body = JSON.stringify(responseInfo);
          console.info('joinInfo: ' + JSON.stringify(response));
          return response;
        }
      }
    }
  }
  return response;
}
async function createMeeting() {
  console.log('Creating Meeting');
  createMeetingCommandInput.ClientRequestToken = randomUUID();
  createMeetingCommandInput.ExternalMeetingId = randomUUID();
  try {
    const meetingInfo: CreateMeetingCommandOutput = await chimeSdkMeetings.send(
      new CreateMeetingCommand(createMeetingCommandInput),
    );
    console.info(`Meeting Info: ${JSON.stringify(meetingInfo)}`);
    return meetingInfo;
  } catch (err) {
    console.info(`Error: ${err}`);
    return false;
  }
}

async function createAttendee(meetingId: string, attendeeEmail: string) {
  console.log(`Creating Attendee for Meeting: ${meetingId}`);
  createAttendeeCommandInput.MeetingId = meetingId;
  createAttendeeCommandInput.ExternalUserId = attendeeEmail;
  const attendeeInfo: CreateAttendeeCommandOutput = await chimeSdkMeetings.send(
    new CreateAttendeeCommand(createAttendeeCommandInput),
  );
  return attendeeInfo;
}

async function putMeetingInfo(joinInfo: JoinInfo) {
  var timeToLive = new Date();
  timeToLive.setMinutes(timeToLive.getMinutes() + 5);
  const putMeetingInfoInput = {
    TableName: meetingInfoTable,
    Item: {
      meetingId: joinInfo.Meeting.MeetingId,
      joinInfo,
      timeToLive: timeToLive.getTime() / 1e3,
    },
  };
  console.log(`info to put: ${JSON.stringify(putMeetingInfoInput)}`);
  try {
    const data: PutCommandOutput = await ddbDocClient.send(
      new PutCommand(putMeetingInfoInput),
    );
    console.log('Success - item added or updated', data);
    return data;
  } catch (err) {
    console.log('Error', err);
    return false;
  }
}
async function checkForMeetings() {
  const scanMeetingInfo: ScanCommandInput = {
    TableName: meetingInfoTable,
    FilterExpression: 'timeToLive >= :currentEpoch',
    ExpressionAttributeValues: {
      ':currentEpoch': Date.now() / 1e3,
    },
  };
  try {
    const data: ScanCommandOutput = await ddbDocClient.send(
      new ScanCommand(scanMeetingInfo),
    );
    console.log(data);
    return data.Items;
  } catch (err) {
    console.log('Error', err);
    return false;
  }
}

async function startTranscribe(meetingId: string) {
  try {
    const transcribeResponse = await chimeSdkMeetings.send(
      new StartMeetingTranscriptionCommand({
        MeetingId: meetingId,
        TranscriptionConfiguration: {
          EngineTranscribeSettings: {
            LanguageCode: 'en-US',
          },
        },
      }),
    );
    console.log(JSON.stringify(transcribeResponse));
    return true;
  } catch (error) {
    return false;
  }
}

async function startCapture(meetingId: string) {
  const createPipelineParams: CreateMediaCapturePipelineCommandInput = {
    ChimeSdkMeetingConfiguration: {
      ArtifactsConfiguration: {
        Audio: { MuxType: 'AudioOnly' },
        CompositedVideo: {
          GridViewConfiguration: {
            ContentShareLayout: 'PresenterOnly',
          },
          Layout: 'GridView',
          Resolution: 'FHD',
        },
        Content: { State: 'Disabled' },
        Video: { State: 'Disabled', MuxType: 'VideoOnly' },
      },
    },
    SinkArn: captureBucketArn,
    SinkType: 'S3Bucket',
    SourceArn: `arn:aws:chime::${awsAccountId}:meeting:${meetingId}`,
    SourceType: 'ChimeSdkMeeting',
    Tags: [{ Key: 'transcription-for-comprehend', Value: 'true' }],
  };
  console.log(JSON.stringify(createPipelineParams));
  try {
    const createMediaCapturePipelineResponse: CreateMediaCapturePipelineCommandOutput =
      await chimeSdkMediaPipelinesClient.send(
        new CreateMediaCapturePipelineCommand(createPipelineParams),
      );
    return createMediaCapturePipelineResponse.MediaCapturePipeline
      ?.MediaPipelineArn;
  } catch (error) {
    console.log(error);
    return false;
  }
}
