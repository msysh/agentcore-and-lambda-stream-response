type MessageStartEvent = {
  messageStart: {
    role: "assistant";
  };
};

type ContentBlockDeltaEvent = {
  contentBlockDelta: {
    delta: {
      text: string;
    };
    contentBlockIndex: number;
  };
};

type ContentBlockStopEvent = {
  contentBlockStop: {
    contentBlockIndex: number;
  };
};

type MessageStopEvent = {
  messageStop: {
    stopReason: "end_turn" | string;
  };
};

type MetadataEvent = {
  metadata: {
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    metrics: {
      latencyMs: number;
    };
  };
};

type AgentCoreStreamEvent =
  | MessageStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageStopEvent
  | MetadataEvent;

export type AgentCoreEvent = {
  event: AgentCoreStreamEvent;
};