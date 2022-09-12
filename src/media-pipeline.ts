import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import {
  Role,
  ServicePrincipal,
  PolicyDocument,
  Effect,
  PolicyStatement,
  ManagedPolicy,
  CfnServiceLinkedRole,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  BlockPublicAccess,
  Bucket,
  EventType,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class MediaPipeline extends Construct {
  public concatBucket: Bucket;
  public captureBucket: Bucket;
  public outputTable: Table;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new CfnServiceLinkedRole(this, 'MediaPipelineSLR', {
      awsServiceName: 'mediapipelines.chime.amazonaws.com',
    });

    this.captureBucket = new Bucket(this, 'captureBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
    });

    this.concatBucket = new Bucket(this, 'concatBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ['*'],
          exposedHeaders: [
            'x-amz-server-side-encryption',
            'x-amz-security-token',
            'x-amz-request-id',
            'x-amz-id-2',
            'ETag',
          ],
          maxAge: 3000,
        },
      ],
      autoDeleteObjects: true,
    });

    const captureBucketPolicy = new PolicyStatement({
      principals: [new ServicePrincipal('mediapipelines.chime.amazonaws.com')],
      sid: 'AWSChimeMediaCaptureBucketPolicy',
      actions: [
        's3:PutObject',
        's3:PutObjectAcl',
        's3:GetObject',
        's3:ListBucket',
      ],
      effect: Effect.ALLOW,
      resources: [
        `${this.captureBucket.bucketArn}/*`,
        `${this.captureBucket.bucketArn}`,
      ],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': Stack.of(this).account,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:chime:*:${Stack.of(this).account}:*`,
        },
      },
    });

    const concatBucketPolicy = new PolicyStatement({
      principals: [new ServicePrincipal('mediapipelines.chime.amazonaws.com')],
      sid: 'AWSChimeMediaConcatBucketPolicy',
      actions: ['s3:PutObject', 's3:PutObjectAcl'],
      effect: Effect.ALLOW,
      resources: [
        `${this.concatBucket.bucketArn}/*`,
        `${this.concatBucket.bucketArn}`,
      ],
      conditions: {
        StringEquals: {
          'aws:SourceAccount': Stack.of(this).account,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:chime:*:${Stack.of(this).account}:*`,
        },
      },
    });

    this.captureBucket.addToResourcePolicy(captureBucketPolicy);
    this.concatBucket.addToResourcePolicy(concatBucketPolicy);

    const eventBridgeLambdaRole = new Role(this, 'eventBridgeLambdaRole', {
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
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const eventBridgeLambda = new NodejsFunction(this, 'eventBridgeLambda', {
      entry: 'src/resources/eventBridge/eventBridge.ts',
      bundling: {
        nodeModules: ['@aws-sdk/client-chime-sdk-media-pipelines'],
      },
      runtime: Runtime.NODEJS_16_X,
      handler: 'lambdaHandler',
      architecture: Architecture.ARM_64,
      role: eventBridgeLambdaRole,
      timeout: Duration.seconds(60),
      environment: {
        CAPTURE_BUCKET_ARN: this.captureBucket.bucketArn,
        CONCAT_BUCKET_ARN: this.concatBucket.bucketArn,
      },
    });

    this.captureBucket.grantReadWrite(eventBridgeLambda);
    this.concatBucket.grantReadWrite(eventBridgeLambda);
    const chimeSdkRule = new Rule(this, 'chimeSdkRule', {
      eventPattern: {
        source: ['aws.chime'],
      },
    });
    chimeSdkRule.addTarget(new LambdaFunction(eventBridgeLambda));

    this.outputTable = new Table(this, 'meetings', {
      partitionKey: {
        name: 'mediaPipelineId',
        type: AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const postMeetingLambdaRole = new Role(this, 'postMeetingLambdaRole', {
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
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    const postMeetingLambda = new NodejsFunction(this, 'postMeetingLambda', {
      entry: 'src/resources/postMeeting/postMeeting.ts',
      bundling: {
        nodeModules: ['@aws-sdk/lib-dynamodb', '@aws-sdk/client-dynamodb'],
      },
      runtime: Runtime.NODEJS_16_X,
      handler: 'lambdaHandler',
      architecture: Architecture.ARM_64,
      role: postMeetingLambdaRole,
      timeout: Duration.seconds(60),
      environment: {
        CAPTURE_BUCKET_ARN: this.captureBucket.bucketArn,
        CONCAT_BUCKET_ARN: this.concatBucket.bucketArn,
        OUTPUT_TABLE: this.outputTable.tableName,
      },
    });

    this.outputTable.grantReadWriteData(postMeetingLambda);

    postMeetingLambda.addEventSource(
      new S3EventSource(this.concatBucket, {
        events: [EventType.OBJECT_CREATED],
      }),
    );
  }
}
