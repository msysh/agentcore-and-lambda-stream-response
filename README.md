# AgentCore Runtime Stream Response with Lambda Stream Response

This demo shows how to proxy the stream response of AgentCore Runtime using Lambda's stream response.

[日本語の情報](https://blog.msysh.me/posts/2025/08/agentcore-runtime-stream-response-via-lambda.html)

## Overview

AgentCore Runtime can respond using streams, and Lambda also supports stream responses. By relaying the stream responses from AgentCore Runtime through Lambda, we can handle various use cases.

### Use Cases

#### Use Case 1: When you want to hide your AWS account ID

There are two ways to call AgentCore Runtime: using IAM authentication with the SDK, or calling the endpoint URL with a JWT. Both methods require specifying the AgentCore Runtime ARN, either in the SDK parameters or in the endpoint URL path. **This means that when calling AgentCore Runtime from a browser or similar, the account ID included in the ARN will be exposed.** If you're making an agent available to the public, it's better to keep the account ID hidden.

* When calling with the SDK
  ```typescript
  const req = new InvokeAgentRuntimeCommand({ agentRuntimeArn: AGENT_ARN, ... });
  ```
* When calling with the AgentCore Runtime endpoint URL
  ```
  https://bedrock-agentcore.{{REGION}}.amazonaws.com/runtimes/{{ENCODED_AGENT_ARN}}/invocations?qualifier=DEFAULT
  ```

#### Use Case 2: When you want to change the response format of AgentCore Runtime

While it depends more on the implementation of various agent SDKs rather than AgentCore Runtime itself, streaming responses typically come as Server-Sent Events (SSE). You can modify or filter responses from AgentCore Runtime on the Lambda side, or send them in a custom format.

#### Use Case 3: When you want to introduce AWS WAF

This benefit comes from adding CloudFront rather than Lambda. When calling the AgentCore Runtime endpoint URL, you can set up AWS WAF on CloudFront by using the structure: CloudFront - Lambda (function URL) - AgentCore.

#### Use Case 4: When you want to use a custom authentication method

To call AgentCore Runtime, you need to use either IAM authentication (SigV4) or JWT like OAuth 2.0. However, you can implement your own authentication method (for example, ID/password authentication) in Lambda.

## Architecture

![Architecture](./docs/architecture.svg)

### Components

* CloudFront: Receives requests from clients and calls Lambda Function URLs using OAC (Origin Access Control).
* Lambda@Edge: When sending POST/PUT requests to Lambda Function URLs, it's necessary to set a SHA256 hash of the request body as a signature in the HTTP header.
* Lambda: Calls the AgentCore Runtime and responds with streaming.
* AgentCore: An AI agent implemented with Strands Agents. It calls Bedrock and responds with streaming.

## How to deploy

### 1. Clone and Install

```bash
git clone https://github.com/msysh/agentcore-and-lambda-stream-response
cd agentcore-and-lambda-stream-response
pnpm install
```

### 2. Deploy AWS Resources

```bash
cdk deploy
```

If you have never run `cdk` command, firstly you may need to run `cdk bootstrap`

After completion deployment, you can get following values. And then please note them.

* AgentCoreExecutionRole: to grant permissions for AgentCore Runtime as execution role.
* EcrRepository: to store container images for AgentCore Runtime
* CloudFrontDistributionUrl: to host Lambda Functions URLs

### 3. Deploy AgentCore Runtime

At first, please confirm Bedrock model ID either you want to use at [assets/agent/main.py](./assets/agent/main.py#L9). You can see supported foundation model IDs in [AWS document](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

```python
model = BedrockModel(model_id="anthropic.claude-3-5-sonnet-20240620-v1:0", region_name=REGION)
```

And then, since AgentCore Runtime can't be deployed using CloudFormation or CDK yet, we will use the toolkit to deploy it.

```bash
cd assets/agent

uv sync
source .venv/bin/activate
```

Intall the AgentCore tool kit.

```bash
uv add --dev bedrock-agentcore-starter-toolkit
uv sync
```

Next, use the `configure` command once to generate a configuration file.

```bash
AWS_REGION=...         # AWS region
EXECUTION_ROLE_ARN=... # Execution role ARN that you've got after `cdk deploy`
ECR_REPOSITORY_URI=... # ECR repository URI that you've got after `cdk deploy`

agentcore configure \
  --name demo_stream_response_agent \
  --entrypoint main.py \
  --authorizer-config 'null' \
  --requirements-file pyproject.toml \
  --region ${AES_REGION} \
  --execution-role ${EXECUTION_ROLE_ARN} \
  --ecr ${ECR_REPOSITORY_URI}
```

After that you'll get `Dockerfile` and `.bedrock-agentcore.yaml`.

Finally, you'll deploy using `launch` command.

```bash
agentcore launch
```

After completion deployment, you can get `Agent ARN` like following:

```
Agent ARN: arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/XXXXX-xxxxxxxxxx
```

### 4. Configure CDK Context

```bash
cd ../../
# or
cd ${This_Project_Root}
```

Create or update `cdk.context.json` at project root with your AgentCore ARN:

```json
{
  "agentcore-lambda-stream-response": {
    "agentArn": "arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/XXXXX-xxxxxxxxxx"
  }
}
```

### 5. Re-deploy AWS Resources (For Update)

```bash
cdk deploy
```

> [!NOTE]
> This deployment will update the Lambda environment variables and execution role with the ARN of AgentCore.

## How to Demo

This demo shows two response formats. The first one sends data from AgentCore Runtime to the client using SSE (Server-Sent Events) without any changes at Lambda.

```bash
curl -X POST https://dxxxxxxxxxxxxx.cloudfront.net/ \
  -d '{"prompt":"hello world!"}'
```

The second format uses Lambda to transform the response from AgentCore Runtime using `"response":"transformed"` option. It takes out only the text that the LLM response and sends it as a stream. It also adds the `runtimeSessionId` from AgentCore Runtime at the end of the output.

```bash
curl -X POST https://dxxxxxxxxxxxxx.cloudfront.net/ \
  -d '{"prompt":"hello world!", "response":"transformed"}'
```

Please refer to [assets/functions/request-handler/handler.ts](https://github.com/msysh/agentcore-and-lambda-stream-response/blob/0ecb8357c30df6997e32de14d1c42dc7ae85c132/assets/functions/request-handler/handler.ts#L58-L78) for the specific implementation details of each function.

### Example Each Responses:

* Keep original stream response
  ```
  curl -X POST https://dxxxxxxxxxxxxx.cloudfront.net/ -d '{"prompt":"hello"}'

  data: {"event": {"messageStart": {"role": "assistant"}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": "Hello! How can"}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": " I assist you today?"}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": " Feel free to ask me"}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": " any questions or let me know if there"}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": "'s anything you'd like help with"}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockDelta": {"delta": {"text": "."}, "contentBlockIndex": 0}}}

  data: {"event": {"contentBlockStop": {"contentBlockIndex": 0}}}

  data: {"event": {"messageStop": {"stopReason": "end_turn"}}}

  data: {"event": {"metadata": {"usage": {"inputTokens": 8, "outputTokens": 33, "totalTokens": 41}, "metrics": {"latencyMs": 1182}}}}
  ```
* Transformed stream response (Specified `"response":"transformed"` option)
  ```
  curl -X POST https://dxxxxxxxxxxxxx.cloudfront.net/ -d '{"prompt":"hello", "response":"transformed"}'

  Hello! How can I assist you today? Feel free to ask me any questions or let me know if you need help with something.
  ----------
  {"usage":{"inputTokens":8,"outputTokens":30,"totalTokens":38},"metrics":{"latencyMs":909}}
  {"runtimeSessionId":"afa31b91-a767-41f1-a7bc-d9cbf8c4cfd3"}%
  ```

You can send the request body with `-d` option following:

```json
{
  "prompt": "...",
  "runtimeSessionId": "...",
  "response": "original|transformed"
}
```

* `response`
  * `original`: Stream the response from AgentCore as it is
  * `transformed`: Take out only the text from AgentCore's response and stream it

## Cleanup

Delete AgentCore Runtime resource.

```bash
aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id ${AGENT_RUNTIME_ID}
```

You can know Agent Runtime ID by following command.

```bash
aws bedrock-agentcore-control list-agent-runtimes \
  --query 'agentRuntimes[].{agentRuntimeId:agentRuntimeId, agentRuntimeName:agentRuntimeName}' \
  --output table
```

Then, delete the CodeBuild project created by the AgentCore toolkit. The build project name is probably `bedrock-agentcore-${agent_name}-builder`.

```bash
aws codebuild delete-project \
  --name bedrock-${AGENT_NAME}-builder
```

At last, delete other AWS resources.

```bash
cdk destroy
```

> [!WARNING]
> Lambda@Edge might fail to delete because it's replicated by CloudFront. If you see a message saying `Please see our documentation for Deleting Lambda@Edge Functions and Replicas`, please wait for a while and then try the `cdk destroy` command again.
> For more information, please refer to the following document
> https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-delete-replicas.html

## License

Apache 2.0
