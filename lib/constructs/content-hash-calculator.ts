import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

type ContentHashCalculatorProps = {
}

export class ContentHashCalculator extends Construct {

  public readonly function: cdk.aws_lambda.Function;

  constructor (scope: Construct, id: string, props?: ContentHashCalculatorProps){
    super(scope, id);

    const lambdaFunction = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'Function', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,
      architecture: cdk.aws_lambda.Architecture.X86_64,
      entry: path.join(__dirname, '../../assets/functions/content-hash-calculator/handler.ts'),
      handler: 'handler',
      memorySize: 128,
      timeout: cdk.Duration.seconds(11),
      bundling: {
        platform: 'node',
        target: 'node22',
        minify: true,
        sourceMap: false,
        tsconfig: path.join(__dirname, '../../assets/functions/content-hash-calculator/tsconfig.json'),
        format: cdk.aws_lambda_nodejs.OutputFormat.ESM,
        forceDockerBundling: false,
        define: {
          'process.env.NODE_ENV': '"production"',
        },
      },
      environment: {
      },
      awsSdkConnectionReuse: false,
      logGroup: new cdk.aws_logs.LogGroup(this, 'LogGroup', {
        retention: cdk.aws_logs.RetentionDays.SIX_MONTHS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      loggingFormat: cdk.aws_lambda.LoggingFormat.JSON,
      systemLogLevelV2: cdk.aws_lambda.SystemLogLevel.WARN,
      applicationLogLevelV2: cdk.aws_lambda.ApplicationLogLevel.DEBUG,
      // tracing: cdk.aws_lambda.Tracing.ACTIVE,
    });

    this.function = lambdaFunction;
  }
}