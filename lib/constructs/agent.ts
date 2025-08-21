import * as cdk from 'aws-cdk-lib';
import {
  aws_iam as iam,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

type AgentProps = {
}

export class Agent extends Construct {
  constructor (scope: Construct, id: string, props?: AgentProps){
    super(scope, id);

    const accountId = cdk.Stack.of(this).account;
    const region = cdk.Stack.of(this).region;

    // -----------------------------
    // ECR repository
    // -----------------------------
    const repository = new cdk.aws_ecr.Repository(this, 'Repository', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    });

    // -----------------------------
    // Execution Role
    // -----------------------------
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com').withConditions({
        StringEquals: {
          'aws:SourceAccount': accountId,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:bedrock-agentcore:${region}:${accountId}:*`,
        },
      }),
      inlinePolicies: {
        'policy': new iam.PolicyDocument({
          statements:[
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModelWithResponseStream',
              ],
              resources: [ '*' ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:GetAuthorizationToken',
              ],
              resources: [ '*' ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
              ],
              resources: [
                repository.repositoryArn
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:GetWorkloadAccessToken',
                'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
                'bedrock-agentcore:GetWorkloadAccessTokenForJWT',
              ],
              resources: [ '*' ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'cloudwatch:PutMetricData',
              ],
              resources: [ '*' ],
              conditions: {
                StringEquals: {
                  'cloudwatch:namespace': 'bedrock-agentcore',
                },
              },
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:DescribeLogStreams',
                'logs:CreateLogGroup',
              ],
              resources: [
                `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              resources: [
                `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:DescribeLogGroups',
              ],
              resources: [
                `arn:aws:logs:${region}:${accountId}:log-group:*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'xray:PutTelemetryRecords',
                'xray:GetSamplingRules',
                'xray:GetSamplingTargets',
                'xray:UpdateTraceSegmentDestination',
                'xray:PutTraceSegments',
              ],
              resources: [ '*' ],
            }),
          ]
        })
      }
    });

    // -----------------------------
    // Output
    // -----------------------------

    new cdk.CfnOutput(this, 'Output-EcrRepository', {
      description: 'AgentCore ECR repository URI',
      value: repository.repositoryUri,
    });

    new cdk.CfnOutput(this, 'Output-AgentCoreExecutionRole', {
      description: 'AgentCore Execution Role Arn',
      value: role.roleArn,
    });
  }
}