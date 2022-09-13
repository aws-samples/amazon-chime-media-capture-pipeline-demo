/*eslint import/no-unresolved: 0 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  UpdateCommandInput,
  UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb';
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

var outputTable = process.env.OUTPUT_TABLE;

import { Handler } from 'aws-cdk-lib/aws-lambda';
import { S3Event } from 'aws-lambda';

export const lambdaHandler: Handler = async (event: S3Event): Promise<null> => {
  console.info(JSON.stringify(event));

  const keyInfo: Array<string> = event.Records[0].s3.object.key.split('/');
  const mediaPipelineId: string = keyInfo[keyInfo.length - 3];
  const keyType: string = keyInfo[keyInfo.length - 2];
  const key: string = event.Records[0].s3.object.key;
  await updateOutputTable(mediaPipelineId, keyType, key);
  return null;
};

async function updateOutputTable(
  mediaPipelineId: string,
  keyType: string,
  key: string,
) {
  const updateOutputTableInput: UpdateCommandInput = {
    TableName: outputTable,
    Key: { mediaPipelineId: mediaPipelineId },
    UpdateExpression: 'SET #kt = :k, #ts = :ts',
    ExpressionAttributeNames: {
      '#kt': keyType,
      '#ts': 'timestamp',
    },
    ExpressionAttributeValues: {
      ':k': key,
      ':ts': Date.now() / 1e3,
    },
  };
  console.log(`info to put: ${JSON.stringify(updateOutputTableInput)}`);
  try {
    const data: UpdateCommandOutput = await ddbDocClient.send(
      new UpdateCommand(updateOutputTableInput),
    );
    console.log('Success - item added or updated', data);
    return data;
  } catch (err) {
    console.log('Error', err);
    return false;
  }
}
