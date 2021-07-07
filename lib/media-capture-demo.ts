import dynamodb = require('@aws-cdk/aws-dynamodb');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import apigateway = require('@aws-cdk/aws-apigateway'); 
import iam = require('@aws-cdk/aws-iam')
import s3 = require('@aws-cdk/aws-s3');
import { Duration } from '@aws-cdk/core';
export interface StackProps {
  ffmpegLayerArn: string;
}
export class MediaCaptureDemo extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: StackProps) {
    super(scope, id);

      const meetingsTable = new dynamodb.Table(this, 'meetings', {
        partitionKey: {
          name: 'Title',
          type: dynamodb.AttributeType.STRING
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        timeToLiveAttribute: 'TTL',
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,            
      });

      const mediaCaptureBucket = new s3.Bucket(this, 'mediaCaptureBucket', {
        publicReadAccess: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true 
      });

      const mediaCaptureBucketPolicy = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:PutObject',
          's3:PutObjectAcl'
        ],
        resources: [
          mediaCaptureBucket.bucketArn,
          `${mediaCaptureBucket.bucketArn}/*`
        ],
        sid: 'AWSChimeMediaCaptureBucketPolicy',
      })
  
      mediaCaptureBucketPolicy.addServicePrincipal('chime.amazonaws.com')
      mediaCaptureBucket.addToResourcePolicy(mediaCaptureBucketPolicy)

      const lambdaChimeRole = new iam.Role(this, 'LambdaChimeRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });
  
      lambdaChimeRole.addToPolicy(new iam.PolicyStatement({
        resources: ['*'],
        actions: ['chime:*']}));
      
      lambdaChimeRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
      

      const sdkBucket = s3.Bucket.fromBucketName(this,'amazon-chime-blog-assets','amazon-chime-blog-assets')

      const sdkLayer = new lambda.LayerVersion(this, 'aws-sdk', {
        code: new lambda.S3Code(sdkBucket, 'aws-sdk2_924_0.zip'),
        compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
        license: 'Apache-2.0',
        description: 'aws-sdk Layer',
      });

      const pythonLayer = new lambda.LayerVersion(this, 'pythonLayer', {
        code: new lambda.AssetCode('python-layer'),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_6],
        license: 'Apache-2.0',
        description: 'media-capture-python-layer',
      });      

      const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ffmpegLayer',props.ffmpegLayerArn)

      const createLambda = new lambda.Function(this, 'create', {
          code: lambda.Code.fromAsset("src/createLambda"),
          handler: 'create.handler',
          runtime: lambda.Runtime.NODEJS_14_X,
          timeout: Duration.seconds(60),
          layers: [ sdkLayer ],
          environment: {
            MEETINGS_TABLE_NAME: meetingsTable.tableName,
          },
          role: lambdaChimeRole
      });

      meetingsTable.grantReadWriteData(createLambda);

      const recordingLambda = new lambda.Function(this, 'recording', {
          code: lambda.Code.fromAsset("src/recordingLambda"),
          handler: 'recording.handler',
          runtime: lambda.Runtime.NODEJS_14_X,
          role: lambdaChimeRole,
          timeout: Duration.seconds(60),          
          layers: [ sdkLayer ],
          environment: {
            MEDIA_CAPTURE_BUCKET: mediaCaptureBucket.bucketName,
            ACCOUNT_ID: cdk.Aws.ACCOUNT_ID
          },          
      });

      mediaCaptureBucket.grantReadWrite(recordingLambda)

      const processLambda = new lambda.Function(this, 'processVideo', {
        code: lambda.Code.fromAsset("src/processLambda"),
        handler: 'process.lambda_handler',
        runtime: lambda.Runtime.PYTHON_3_6,
        role: lambdaChimeRole,
        memorySize: 10240,
        timeout: Duration.minutes(15),          
        layers: [ pythonLayer, ffmpegLayer ],
        environment: {
          MEDIA_CAPTURE_BUCKET: mediaCaptureBucket.bucketName,
        },          
      });
    
      meetingsTable.grantReadWriteData(processLambda);

      const api = new apigateway.RestApi(this, 'meetingApi', {
          endpointConfiguration: {
            types: [ apigateway.EndpointType.REGIONAL ]
          }
      });

      const apiURL = new cdk.CfnOutput(this, 'apiURL', { 
        value: api.url,
      });        

    
      const create = api.root.addResource('create');
      const createIntegration = new apigateway.LambdaIntegration(createLambda);
      create.addMethod('POST', createIntegration);
      addCorsOptions(create);

      const record = api.root.addResource('record');
      const recordIntegration = new apigateway.LambdaIntegration(recordingLambda);
      record.addMethod('POST', recordIntegration);
      addCorsOptions(record);

      const process = api.root.addResource('process');
      const processIntegration = new apigateway.LambdaIntegration(processLambda)
      process.addMethod('POST', processIntegration);
      addCorsOptions(process);
    };
  };


export function addCorsOptions(apiResource: apigateway.IResource) {
apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
  integrationResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
      'method.response.header.Access-Control-Allow-Credentials': "'false'",
      'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
    },
  }],
  passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
  requestTemplates: {
    "application/json": "{\"statusCode\": 200}"
  },
}), {
  methodResponses: [{
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Credentials': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    },  
  }]
})
}