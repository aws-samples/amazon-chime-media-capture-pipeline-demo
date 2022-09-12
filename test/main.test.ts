import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AmazonChimeSDKWithTranscribe } from '../src/amazon-chime-sdk-meeting-with-transcribe';

test('Snapshot', () => {
  const app = new App();
  const stack = new AmazonChimeSDKWithTranscribe(app, 'test');

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
