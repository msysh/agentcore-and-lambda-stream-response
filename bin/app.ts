#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Stack } from '../lib/stack';

const app = new cdk.App();

type ContextParameter = {
  readonly agentArn: string;
}
const ctxParam = app.node.tryGetContext('agentcore-lambda-stream-response') as ContextParameter;

new Stack(app, 'AgentCoreLambdaStreamResponse', {
  agentArn: ctxParam.agentArn,
});