import type { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import type { ResolvedAiConfig } from './ai-settings-service.js';

/** Minimal model surface the AI orchestrator depends on, so tests can inject scripted streams. */
export interface AiChatModel {
  stream(
    messages: BaseMessage[],
    options: { signal?: AbortSignal },
  ): AsyncIterable<AIMessageChunk>;
  invoke(messages: BaseMessage[], options?: { signal?: AbortSignal }): Promise<AIMessage>;
  /**
   * Optional tool-calling support. Kept optional so scripted test stubs stay valid; agents that
   * need tools must degrade gracefully when a model does not implement it.
   */
  bindTools?(tools: StructuredToolInterface[]): {
    invoke(messages: BaseMessage[], options?: { signal?: AbortSignal }): Promise<AIMessage>;
  };
}

export type AiModelFactory = (config: ResolvedAiConfig) => AiChatModel;

/**
 * Builds an OpenAI-compatible chat model (DeepSeek by default) through `@langchain/openai`.
 * `streamUsage` is required for the `usage_metadata` chunks the usage ledger records.
 */
export function createLangChainModelFactory(): AiModelFactory {
  return (config) => {
    const chat = new ChatOpenAI({
      apiKey: config.apiKey ?? 'missing-api-key',
      model: config.model,
      temperature: config.temperature,
      maxRetries: 0,
      timeout: config.timeoutMs,
      streaming: true,
      streamUsage: true,
      configuration: { baseURL: config.baseUrl },
    });

    return {
      async *stream(messages, { signal }) {
        const stream = await chat.stream(messages, { signal });
        for await (const chunk of stream) {
          yield chunk;
        }
      },
      async invoke(messages, options) {
        return (await chat.invoke(messages, options)) as AIMessage;
      },
      bindTools(tools) {
        const bound = chat.bindTools(tools);
        return {
          async invoke(messages, options) {
            return (await bound.invoke(messages, options)) as AIMessage;
          },
        };
      },
    };
  };
}
