#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { MediaCaptureDemo } from '../lib/media-capture-demo';

const app = new cdk.App();

const ffmpegLayerArn = app.node.tryGetContext('ffmpegLayerARN')

new MediaCaptureDemo(app, 'MediaCaptureDemo', {
  ffmpegLayerArn: ffmpegLayerArn,
});
