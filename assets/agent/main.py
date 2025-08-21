import os
from bedrock_agentcore import RequestContext
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel

REGION=os.getenv('AWS_REGION', 'us-east-1')

model = BedrockModel(model_id="anthropic.claude-3-5-sonnet-20240620-v1:0", region_name=REGION)
agent = Agent(model=model)

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload: dict, context: RequestContext):
    user_message = payload.get('prompt')
    stream = agent.stream_async(user_message)
    async for event in stream:
        print(event)
        if 'event' in event:
            yield event

if __name__ == '__main__':
    app.run()