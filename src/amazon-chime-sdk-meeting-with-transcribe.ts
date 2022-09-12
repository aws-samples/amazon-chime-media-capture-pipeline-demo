import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Site, Infrastructure, MediaPipeline, Cognito } from './index';

export class AmazonChimeSDKWithTranscribe extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const mediapipeline = new MediaPipeline(this, 'mediapipeline');

    const allowedDomain = this.node.tryGetContext('AllowedDomain');
    const cognito = new Cognito(this, 'Cognito', {
      allowedDomain: allowedDomain,
      concatBucket: mediapipeline.concatBucket,
    });

    const infrastructure = new Infrastructure(this, 'infrastructure', {
      captureBucket: mediapipeline.captureBucket,
      concatBucket: mediapipeline.concatBucket,
      outputTable: mediapipeline.outputTable,
    });

    const site = new Site(this, 'Site', {
      apiUrl: infrastructure.apiUrl,
      concatBucket: mediapipeline.concatBucket,
      userPool: cognito.userPool,
      userPoolClient: cognito.userPoolClient,
      identityPool: cognito.identityPool,
    });

    new CfnOutput(this, 'distribution', {
      value: site.distribution.domainName,
    });

    new CfnOutput(this, 'siteBucket', { value: site.siteBucket.bucketName });
  }
}
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new AmazonChimeSDKWithTranscribe(app, 'AmazonChimeSDKWithTranscribe', {
  env: devEnv,
});

app.synth();
