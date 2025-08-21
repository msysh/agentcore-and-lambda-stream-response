import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

type RequestHandlerProps = {
  agentArn: string;
}

export class RequestHandler extends Construct {

  public readonly function: cdk.aws_lambda.IFunction;
  public readonly functionUrl: cdk.aws_lambda.IFunctionUrl;

  constructor (scope: Construct, id: string, props: RequestHandlerProps){
    super(scope, id);

    const {
      agentArn,
    } = props;

    const role = new cdk.aws_iam.Role(this, 'Role', {
      assumedBy: new cdk.aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        'policy': new cdk.aws_iam.PolicyDocument({
          statements:[
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'bedrock-agentcore:InvokeAgentRuntime',
              ],
              resources: [
                agentArn,
                `${agentArn}/runtime-endpoint/*`,
              ]
            }),
            new cdk.aws_iam.PolicyStatement({
              effect: cdk.aws_iam.Effect.ALLOW,
              actions: [
                'xray:PutTraceSegments',
                'xray:PutTelemetryRecords',
              ],
              resources: [ '*' ],
            }),
          ]
        })
      }
    });

    const lambdaFunction = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'Function', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      architecture: cdk.aws_lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../assets/functions/request-handler/handler.ts'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(300),
      role: role,
      bundling: {
        minify: true,
        tsconfig: path.join(__dirname, '../../assets/functions/request-handler/tsconfig.json'),
        format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
        bundleAwsSDK: true,
        banner: 'import { createRequire } from \'module\';const require = createRequire(import.meta.url)',
      },
      environment: {
        AGENT_ARN: agentArn,
      },
      awsSdkConnectionReuse: false,
      logGroup: new cdk.aws_logs.LogGroup(this, 'LogGroup', {
        retention: cdk.aws_logs.RetentionDays.SIX_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      loggingFormat: cdk.aws_lambda.LoggingFormat.JSON,
      systemLogLevelV2: cdk.aws_lambda.SystemLogLevel.INFO,
      applicationLogLevelV2: cdk.aws_lambda.ApplicationLogLevel.TRACE,
      tracing: cdk.aws_lambda.Tracing.ACTIVE,
    });

    // Function URLs
    const lambdaFunctionUrl = lambdaFunction.addFunctionUrl({
      authType: cdk.aws_lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: cdk.aws_lambda.InvokeMode.RESPONSE_STREAM,
    });

    this.function = lambdaFunction;
    this.functionUrl = lambdaFunctionUrl;
  }
}