#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import { MediaCaptureDemo } from '../lib/media-capture-demo';

const app = new cdk.App();

new MediaCaptureDemo(app, 'MediaCaptureDemo');
