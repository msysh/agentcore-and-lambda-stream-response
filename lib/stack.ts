import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { ContentHashCalculator } from './constructs/content-hash-calculator';
import { RequestHandler } from './constructs/request-handler';
import { Agent } from './constructs/agent';

type StackProps = cdk.StackProps & {
  agentArn: string;
}

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const {
      agentArn,
    } = props;

    // -----------------------------
    // AgentCore Related Resources
    // -----------------------------
    const agent = new Agent(this, 'Agent');

    // -----------------------------
    // Lambda for Content Hash Calculator
    // -----------------------------
    const contentHashCalculator = new ContentHashCalculator(this, 'ContentHashCalculator');

    // -----------------------------
    // Lambda for Request Handler
    // -----------------------------
    const requestHandler = new RequestHandler(this, 'RequestHandler', {
      agentArn
    });

    // -----------------------------
    // CloudFront Distribution
    // -----------------------------
    const distribution = new cdk.aws_cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: cdk.aws_cloudfront_origins.FunctionUrlOrigin.withOriginAccessControl(requestHandler.functionUrl),
        viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cdk.aws_cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        responseHeadersPolicy: cdk.aws_cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        edgeLambdas: [
          {
            functionVersion: contentHashCalculator.function.currentVersion,
            eventType: cdk.aws_cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
            includeBody: true,
          },
        ],
      },
    });

    // -----------------------------
    // Output
    // -----------------------------
    new cdk.CfnOutput(this, 'Output-CloudFrontDistributionUrl', {
      description: 'CloudFront Distribution URL',
      value: `https://${distribution.distributionDomainName}/`,
    });
  }
}
