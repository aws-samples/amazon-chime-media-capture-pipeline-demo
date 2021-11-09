import dynamodb = require("@aws-cdk/aws-dynamodb");
import lambda = require("@aws-cdk/aws-lambda");
import cdk = require("@aws-cdk/core");
import apigateway = require("@aws-cdk/aws-apigateway");
import iam = require("@aws-cdk/aws-iam");
import s3 = require("@aws-cdk/aws-s3");
import { Duration } from "@aws-cdk/core";
import events = require("@aws-cdk/aws-events");
import targets = require("@aws-cdk/aws-events-targets");
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";

export class MediaCaptureDemo extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    const meetingsTable = new dynamodb.Table(this, "meetings", {
      partitionKey: {
        name: "Title",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "TTL",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    meetingsTable.addGlobalSecondaryIndex({
      indexName: "meetingIdIndex",
      partitionKey: {
        name: "meetingId",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const mediaCaptureBucket = new s3.Bucket(this, "mediaCaptureBucket", {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const mediaCaptureBucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["s3:PutObject", "s3:PutObjectAcl"],
      resources: [
        mediaCaptureBucket.bucketArn,
        `${mediaCaptureBucket.bucketArn}/*`,
      ],
      sid: "AWSChimeMediaCaptureBucketPolicy",
    });

    mediaCaptureBucketPolicy.addServicePrincipal("chime.amazonaws.com");
    mediaCaptureBucket.addToResourcePolicy(mediaCaptureBucketPolicy);

    const lambdaChimeRole = new iam.Role(this, "LambdaChimeRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaChimeRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: ["chime:*"],
      })
    );

    lambdaChimeRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole"
      )
    );

    const sdkBucket = s3.Bucket.fromBucketName(
      this,
      "amazon-chime-blog-assets",
      "amazon-chime-blog-assets"
    );

    const createLambda = new NodejsFunction(this, "createLambda", {
      entry: "src/createLambda/create.js",
      depsLockFilePath: "src/createLambda/package-lock.json",
      bundling: {
        externalModules: ["aws-sdk"],
        nodeModules: ["uuid"],
      },
      runtime: lambda.Runtime.NODEJS_14_X,
      timeout: Duration.seconds(60),
      environment: {
        MEETINGS_TABLE_NAME: meetingsTable.tableName,
      },
      role: lambdaChimeRole,
    });

    meetingsTable.grantReadWriteData(createLambda);

    const recordingLambda = new NodejsFunction(this, "recordingLambda", {
      entry: "src/recordingLambda/recording.js",
      depsLockFilePath: "src/recordingLambda/package-lock.json",
      bundling: {
        externalModules: ["aws-sdk"],
        nodeModules: ["uuid"],
      },
      runtime: lambda.Runtime.NODEJS_14_X,
      role: lambdaChimeRole,
      timeout: Duration.seconds(60),
      environment: {
        MEDIA_CAPTURE_BUCKET: mediaCaptureBucket.bucketName,
        ACCOUNT_ID: cdk.Aws.ACCOUNT_ID,
      },
    });

    mediaCaptureBucket.grantReadWrite(recordingLambda);

    const processLambda = new lambda.DockerImageFunction(this, "proces", {
      code: lambda.DockerImageCode.fromImageAsset("src/processLambda", {
        cmd: ["app.handler"],
        entrypoint: ["/entry.sh"],
      }),
      environment: {
        MEDIA_CAPTURE_BUCKET: mediaCaptureBucket.bucketName,
        MEETINGS_TABLE_NAME: meetingsTable.tableName,
      },
      timeout: Duration.minutes(15),
      memorySize: 10240,
    });

    meetingsTable.grantReadWriteData(processLambda);
    mediaCaptureBucket.grantReadWrite(processLambda);

    const processOutputRule = new events.Rule(this, "processRecordingRule", {
      eventPattern: {
        source: ["aws.chime"],
        detailType: ["Chime Media Pipeline State Change"],
        detail: {
          eventType: ["chime:MediaPipelineDeleted"],
        },
      },
    });

    processOutputRule.addTarget(new targets.LambdaFunction(processLambda));

    const api = new apigateway.RestApi(this, "meetingApi", {
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });

    const apiURL = new cdk.CfnOutput(this, "apiURL", {
      value: api.url,
    });

    const create = api.root.addResource("create");
    const createIntegration = new apigateway.LambdaIntegration(createLambda);
    create.addMethod("POST", createIntegration);
    addCorsOptions(create);

    const record = api.root.addResource("record");
    const recordIntegration = new apigateway.LambdaIntegration(recordingLambda);
    record.addMethod("POST", recordIntegration);
    addCorsOptions(record);
  }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
  apiResource.addMethod(
    "OPTIONS",
    new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers":
              "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
            "method.response.header.Access-Control-Allow-Origin": "'*'",
            "method.response.header.Access-Control-Allow-Credentials":
              "'false'",
            "method.response.header.Access-Control-Allow-Methods":
              "'OPTIONS,GET,PUT,POST,DELETE'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        "application/json": '{"statusCode": 200}',
      },
    }),
    {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Headers": true,
            "method.response.header.Access-Control-Allow-Methods": true,
            "method.response.header.Access-Control-Allow-Credentials": true,
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    }
  );
}
