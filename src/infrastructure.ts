import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
  ManagedPolicy,
  CfnServiceLinkedRole,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface InfrastructureProps {
  captureBucket: Bucket;
  concatBucket: Bucket;
  outputTable: Table;
}
export class Infrastructure extends Construct {
  public readonly apiUrl: string;
  constructor(scope: Construct, id: string, props: InfrastructureProps) {
    super(scope, id);

    new CfnServiceLinkedRole(this, 'TranscriptionSLR', {
      awsServiceName: 'transcription.chime.amazonaws.com',
    });

    const meetingsTable = new Table(this, 'meetings', {
      partitionKey: {
        name: 'meetingId',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'timeToLive',
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const infrastructureRole = new Role(this, 'infrastructureRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:*'],
            }),
          ],
        }),
        ['transcribePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['transcribe:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const meetingLambda = new NodejsFunction(this, 'meetingLambda', {
      entry: 'src/resources/meetingInfo/meetingInfo.ts',
      runtime: Runtime.NODEJS_16_X,
      handler: 'lambdaHandler',
      architecture: Architecture.ARM_64,
      role: infrastructureRole,
      timeout: Duration.seconds(60),
      environment: {
        MEETINGS_TABLE: meetingsTable.tableName,
        OUTPUT_TABLE: props.outputTable.tableName,
        CAPTURE_BUCKET_ARN: props.captureBucket.bucketArn,
        CONCAT_BUCKET_ARN: props.concatBucket.bucketArn,
        AWS_ACCOUNT_ID: Stack.of(this).account,
      },
    });

    meetingsTable.grantReadWriteData(meetingLambda);
    props.outputTable.grantReadWriteData(meetingLambda);
    props.concatBucket.grantReadWrite(meetingLambda);
    props.captureBucket.grantReadWrite(meetingLambda);

    const api = new RestApi(this, 'ChimeSDKMeetingWithTranscribeAPI', {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'X-Amz-Security-Token',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'POST'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const meeting = api.root.addResource('meeting');
    const end = api.root.addResource('end');
    const recordings = api.root.addResource('recordings');

    const meetingIntegration = new LambdaIntegration(meetingLambda);

    meeting.addMethod('POST', meetingIntegration, {});
    end.addMethod('POST', meetingIntegration, {});
    recordings.addMethod('POST', meetingIntegration, {});

    this.apiUrl = api.url;
  }
}
