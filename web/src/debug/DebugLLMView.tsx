import { Box, Heading, List, Text } from "@chakra-ui/react";
import { useCommanderStore } from "../state/store";

function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryFormatEmbeddedJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const fencedPrefix = "```json";
  const fencedSuffix = "```";
  const candidate =
    trimmed.startsWith(fencedPrefix) && trimmed.endsWith(fencedSuffix)
      ? trimmed
          .slice(fencedPrefix.length, trimmed.length - fencedSuffix.length)
          .trim()
      : trimmed;

  try {
    return JSON.stringify(JSON.parse(candidate), null, 2);
  } catch {
    return raw;
  }
}

// @spec PRESENT-DBG-005, PRESENT-DBG-006, PRESENT-DBG-007, PRESENT-DBG-008
export function DebugLLMView() {
  const llmDebugLog = useCommanderStore((s) => s.llmDebugLog);

  return (
    <Box className="debug-llm-view">
      <Heading as="h2" size="md" textStyle="header">
        LLM Debug
      </Heading>
      <Text textStyle="body">entries: {llmDebugLog.length}</Text>
      {llmDebugLog.length === 0 ? (
        <Text textStyle="body">No LLM calls recorded yet.</Text>
      ) : (
        <List.Root className="debug-llm-list">
          {[...llmDebugLog].reverse().map((entry, index) => (
            <List.Item key={`${entry.turnId}-${entry.timestamp}-${index}`}>
              <Text textStyle="body">
                {new Date(entry.timestamp).toISOString()} [{entry.phase}]{" "}
                {entry.providerId}/{entry.modelId}
              </Text>
              <Text as="pre" textStyle="caption" className="debug-llm-message">
                {entry.message}
              </Text>
              {entry.payload ? (
                <Box className="debug-llm-payload">
                  <Text textStyle="caption">payload</Text>
                  <Text
                    as="pre"
                    textStyle="caption"
                    className="debug-llm-message"
                  >
                    {(() => {
                      const payload = entry.payload as Record<string, unknown>;
                      const systemPrompt =
                        typeof payload.systemPrompt === "string"
                          ? payload.systemPrompt
                          : null;
                      const messages = Array.isArray(payload.messages)
                        ? payload.messages
                        : null;
                      const responseText =
                        typeof payload.responseText === "string"
                          ? payload.responseText
                          : null;
                      const requestBody = payload.requestBody;
                      const responseBody = payload.responseBody;

                      if (
                        !systemPrompt &&
                        !messages &&
                        !requestBody &&
                        !responseText &&
                        !responseBody
                      ) {
                        return formatUnknown(payload);
                      }

                      const formattedMessages = messages
                        ? formatUnknown(messages)
                        : "[]";
                      const formattedResponseText = responseText
                        ? tryFormatEmbeddedJson(responseText)
                        : "(none)";
                      const formattedRequestBody =
                        requestBody !== undefined
                          ? formatUnknown(requestBody)
                          : "(none)";
                      const formattedResponseBody =
                        responseBody !== undefined
                          ? formatUnknown(responseBody)
                          : "(none)";

                      return [
                        `systemPrompt:\n${systemPrompt ?? "(none)"}`,
                        `messages:\n${formattedMessages}`,
                        `requestBody:\n${formattedRequestBody}`,
                        `responseText:\n${formattedResponseText}`,
                        `responseBody:\n${formattedResponseBody}`,
                      ].join("\n\n");
                    })()}
                  </Text>
                </Box>
              ) : null}
            </List.Item>
          ))}
        </List.Root>
      )}
    </Box>
  );
}
