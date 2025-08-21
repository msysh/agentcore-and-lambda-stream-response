import { promisify } from 'util';
import { pipeline as pipelineAsync, Readable, Writable } from 'stream';
import { randomUUID } from 'crypto';
import {
  LambdaFunctionURLEvent,
  Context,
  StreamifyHandler,
} from 'aws-lambda';
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';

import type { AgentCoreEvent } from './types/agentcore-stream-event';

const AGENT_ARN = process.env.AGENT_ARN;

const pipeline = promisify(pipelineAsync);

const agentCore = new BedrockAgentCoreClient();

type UserRequest = {
  runtimeSessionId?: string;
  prompt: string;
  response?: "original" | "transformed";
}

export const handler: StreamifyHandler = awslambda.streamifyResponse(
  async (event: LambdaFunctionURLEvent, responseStream: NodeJS.WritableStream, context: Context) => {
    console.trace(event);

    const userRequest: UserRequest = extractUserRequest(event);
    console.debug({ userRequest });

    const httpResponseMetadata = {
      statusCode: 200,
      headers: {
        'Content-Type': userRequest.response === 'transformed' ? 'text/plain; charset=utf-8' : 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    };
    responseStream = awslambda.HttpResponseStream.from(responseStream as Writable, httpResponseMetadata);

    try {
      const req = new InvokeAgentRuntimeCommand({
        agentRuntimeArn: AGENT_ARN,
        runtimeSessionId: userRequest.runtimeSessionId,
        payload: new TextEncoder().encode(JSON.stringify({
          'prompt': userRequest.prompt,
        })) ,
        qualifier: 'DEFAULT',
      });

      const agentResponse = await agentCore.send(req);
      console.trace(agentResponse);
      console.info((({ traceId, traceParent, traceState }) => ({ traceId, traceParent, traceState }))(agentResponse));

      if (userRequest.response === 'transformed'){
        // Transformed stream response
        const abortController = new AbortController();

        await pipeline(
          agentResponse.response as Readable,
          transform,
          responseStream,
          {
            signal: abortController.signal,
            end: false,
          },
        );

        responseStream.write('\n' + JSON.stringify({ 'runtimeSessionId': agentResponse.runtimeSessionId }));
        responseStream.end();
      }
      else {
        // Original stream response
        await pipeline(agentResponse.response as Readable, responseStream);
      }
    }
    catch (e) {
      console.error(e);
      responseStream.write('Error!');
      if (e instanceof Error) {
        responseStream.write(' - ' + e.message);
      }
      responseStream.end();
    }
  }
);

const extractUserRequest = (event: LambdaFunctionURLEvent): UserRequest => {
  let userRequest: UserRequest;
  if (event.isBase64Encoded && 'body' in event) {
    userRequest = JSON.parse(Buffer.from(event.body!, 'base64').toString('utf-8'));
  }
  else if ('queryStringParameters' in event && 'prompt' in event.queryStringParameters!){
    userRequest = (({ prompt, runtimeSessionId }) => ({ prompt, runtimeSessionId }))(event.queryStringParameters as UserRequest);
  }
  else {
    userRequest = { prompt: 'hello world' };
  }

  if (!('runtimeSessionId' in userRequest) || !userRequest.runtimeSessionId) {
    // should to satisfy runtimeSessionId requirement
    userRequest.runtimeSessionId = randomUUID();
  }

  if (!('response' in userRequest) || userRequest.response !== 'transformed') {
    userRequest.response = 'original';
  }

  return userRequest;
};

const transform = async function* (source: AsyncIterable<string>) {
  (source as Readable).setEncoding('utf8');

  for await (const chunk of source) {
    console.trace(chunk);

    let responseMessage = '';
    chunk.split('\n').forEach((line: string) => {

      if (line.length === 0) {
        return;
      }

      const eventData: AgentCoreEvent = JSON.parse(line.replace(/^data: /, ''));
      // https://docs.aws.amazon.com/ja_jp/bedrock/latest/userguide/conversation-inference-call.html#conversation-inference-call-response-converse-stream
      if ('messageStart' in eventData.event) {
        console.info('Message Start');
      }
      else if ('contentBlockDelta' in eventData.event) {
        if ('text' in eventData.event.contentBlockDelta.delta) {
          console.debug(eventData.event.contentBlockDelta.delta.text);
          responseMessage += eventData.event.contentBlockDelta.delta.text;
        }
      }
      else if ('contentBlockStop' in eventData.event) {
        console.info('Content Block Stop');
      }
      else if ('messageStop' in eventData.event) {
        console.info(`Message Stop (stop reason: ${eventData.event.messageStop.stopReason})`);
      }
      else if ('metadata' in eventData.event){
        console.info(eventData.event);
        responseMessage = '\n----------\n' + JSON.stringify(eventData.event.metadata);
      }
    });

    yield responseMessage;
  }
};
