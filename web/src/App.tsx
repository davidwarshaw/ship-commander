import {
  Accordion,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  List,
  NativeSelect,
  Text,
  VStack,
} from "@chakra-ui/react";
import { FormEvent, useEffect, useState } from "react";
import { CrewInfo } from "./components/CrewInfo";
import { CrewTag } from "./components/CrewTag";
import { DebugLLMView } from "./debug/DebugLLMView";
import { DebugSimulationView } from "./debug/DebugSimulationView";
import {
  getBridgeCrewDefinition,
  resolveCrewMemberBySpeakerToken,
} from "./crew/crewCatalog";
import { useCommanderStore } from "./state/store";
import { StatusShipView } from "./status/StatusShipView";
import { TacticalCanvas } from "./tactical/TacticalCanvas";

// @spec PRESENT-CHAKRA-006, PRESENT-CHAKRA-008, PRESENT-CHAKRA-009, PRESENT-SET-001, PRESENT-SET-008A, PRESENT-SET-008C, PRESENT-BIND-009, PRESENT-BIND-010, PRESENT-LOG-004, PRESENT-LOG-005, PRESENT-LOG-006, PRESENT-LOG-007, PRESENT-LOG-008, PRESENT-LOG-009, PRESENT-MODE-009, PRESENT-MODE-010, PRESENT-DBG-001, PRESENT-DBG-005, PRESENT-DBG-009
export function App() {
  const [commandDraft, setCommandDraft] = useState("");
  const viewMode = useCommanderStore((s) => s.viewMode);
  const commandLog = useCommanderStore((s) => s.commandLog);
  const simulationTimeMinutes = useCommanderStore(
    (s) => s.simulationTimeMinutes,
  );
  const llmSettings = useCommanderStore((s) => s.llmSettings);
  const apiKeyInput = useCommanderStore((s) => s.apiKeyInput);
  const settingsNotice = useCommanderStore((s) => s.settingsNotice);
  const unsavedLLMSettings = useCommanderStore((s) => s.unsavedLLMSettings);
  const devScriptRunStatus = useCommanderStore((s) => s.devScriptRunStatus);
  const devScriptRunMessage = useCommanderStore((s) => s.devScriptRunMessage);
  const initializeSessionLock = useCommanderStore(
    (s) => s.initializeSessionLock,
  );
  const setViewMode = useCommanderStore((s) => s.setViewMode);
  const setLLMProvider = useCommanderStore((s) => s.setLLMProvider);
  const setLLMModel = useCommanderStore((s) => s.setLLMModel);
  const setLLMApiKeyInput = useCommanderStore((s) => s.setLLMApiKeyInput);
  const saveLLMSettings = useCommanderStore((s) => s.saveLLMSettings);
  const submitCommand = useCommanderStore((s) => s.submitCommand);
  const runDevOrderTestScript = useCommanderStore((s) => s.runDevOrderTestScript);
  const bridgeCrew = getBridgeCrewDefinition("bridge-crew");

  useEffect(() => {
    initializeSessionLock();
  }, [initializeSessionLock]);

  const onSubmitCommand = (event: FormEvent) => {
    event.preventDefault();
    void submitCommand(commandDraft);
    setCommandDraft("");
  };

  const hours = Math.floor(simulationTimeMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (simulationTimeMinutes % 60).toString().padStart(2, "0");
  const modelOptions =
    llmSettings.providerId === "mock-local"
      ? ["mock-v1"]
      : llmSettings.providerId === "anthropic-claude"
        ? ["claude-sonnet-4-6"]
        : [];
  const showDebugView = import.meta.env.DEV;

  return (
    <Box className="app-shell">
      <Box as="aside" className="command-panel">
        <Accordion.Root collapsible defaultValue={[]} className="command-form">
          <Accordion.Item value="settings">
            <Accordion.ItemTrigger>
              <Text textStyle="header">Settings</Text>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <VStack align="stretch">
                  {settingsNotice ? (
                    <Text textStyle="body">
                      <Text as="span" className="warning-pill" textStyle="body">
                        {settingsNotice}
                      </Text>
                    </Text>
                  ) : null}
                  <Text as="label" htmlFor="provider-select" textStyle="body">
                    LLM Provider
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      id="provider-select"
                      value={llmSettings.providerId}
                      onChange={(e) => setLLMProvider(e.target.value)}
                    >
                      <option value="mock-local">mock-local</option>
                      <option value="anthropic-claude">anthropic-claude</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Text as="label" htmlFor="model-select" textStyle="body">
                    Model
                  </Text>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      id="model-select"
                      value={llmSettings.modelId}
                      onChange={(e) => setLLMModel(e.target.value)}
                    >
                      {modelOptions.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Text as="label" htmlFor="api-key-input" textStyle="body">
                    API Key
                  </Text>
                  <Input
                    id="api-key-input"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setLLMApiKeyInput(e.target.value)}
                    placeholder={
                      llmSettings.apiKey ? "••••••••" : "Enter API key"
                    }
                  />
                  <Button
                    className="action-btn"
                    type="button"
                    onClick={saveLLMSettings}
                  >
                    Save settings
                  </Button>
                  {unsavedLLMSettings ? (
                    <Text textStyle="body">LLM settings draft is unsaved.</Text>
                  ) : null}
                </VStack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
        <Text className="simulation-time" textStyle="body">
          Simulation time:{" "}
          <Text as="strong" textStyle="body">
            {hours}:{minutes}
          </Text>
        </Text>
        <Accordion.Root
          collapsible
          defaultValue={["crew-list"]}
          className="crew-list-accordion"
        >
          <Accordion.Item value="crew-list">
            <Accordion.ItemTrigger>
              <Heading as="h2" size="md" textStyle="header">
                Bridge Crew
              </Heading>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <List.Root className="command-list bridge-crew-list">
                  {bridgeCrew ? (
                    bridgeCrew.crew.map((member) => (
                      <List.Item key={member.name}>
                        <CrewInfo member={member} />
                      </List.Item>
                    ))
                  ) : (
                    <List.Item>
                      <Text textStyle="body">Bridge crew unavailable.</Text>
                    </List.Item>
                  )}
                </List.Root>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
        <Heading as="h2" size="md" textStyle="header">
          Command Log
        </Heading>
        <List.Root className="command-list">
          {commandLog.map((line) => {
            const [rawSpeaker, ...messageParts] = line.text.split(":");
            const hasSpeakerToken = messageParts.length > 0;
            if (!bridgeCrew || !hasSpeakerToken) {
              return (
                <List.Item key={line.id}>
                  <Text textStyle="body">{line.text}</Text>
                </List.Item>
              );
            }
            const member = resolveCrewMemberBySpeakerToken(
              bridgeCrew,
              rawSpeaker,
            );
            if (!member) {
              return (
                <List.Item key={line.id}>
                  <Text textStyle="body">{line.text}</Text>
                </List.Item>
              );
            }
            const message = messageParts.join(":").trim();
            return (
              <List.Item key={line.id}>
                <HStack className="command-log-line" align="start">
                  <Box className="command-log-speaker">
                    <CrewTag member={member} variant="compact" />
                  </Box>
                  <Text className="command-log-message" textStyle="body">
                    {message}
                  </Text>
                </HStack>
              </List.Item>
            );
          })}
        </List.Root>
        <Box
          as="form"
          className="command-form command-form-bottom"
          onSubmit={onSubmitCommand}
        >
          <Text as="label" htmlFor="command-input" textStyle="body">
            Captain command
          </Text>
          <HStack className="command-form-row">
            <Input
              id="command-input"
              value={commandDraft}
              onChange={(e) => setCommandDraft(e.target.value)}
              placeholder="Issue a command..."
            />
            <Button type="submit" className="action-btn">
              Send
            </Button>
          </HStack>
        </Box>
        {showDebugView ? (
          <VStack align="stretch" className="dev-script-runner">
            <Button
              className="action-btn"
              type="button"
              onClick={() => void runDevOrderTestScript()}
              disabled={devScriptRunStatus === "running"}
            >
              Run test script
            </Button>
            {devScriptRunMessage ? (
              <Text textStyle="caption">{devScriptRunMessage}</Text>
            ) : null}
          </VStack>
        ) : null}
      </Box>
      <Box as="main" className="tactical-panel">
        <HStack className="view-mode-toggle">
          <Button
            className={
              viewMode === "tactical" ? "action-btn selected" : "action-btn"
            }
            onClick={() => setViewMode("tactical")}
          >
            Tactical
          </Button>
          <Button
            className={
              viewMode === "status" ? "action-btn selected" : "action-btn"
            }
            onClick={() => setViewMode("status")}
          >
            Status
          </Button>
          {showDebugView ? (
            <Button
              className={
                viewMode === "debug" ? "action-btn selected" : "action-btn"
              }
              onClick={() => setViewMode("debug")}
            >
              Debug
            </Button>
          ) : null}
          {showDebugView ? (
            <Button
              className={
                viewMode === "llm-debug" ? "action-btn selected" : "action-btn"
              }
              onClick={() => setViewMode("llm-debug")}
            >
              LLM Debug
            </Button>
          ) : null}
        </HStack>
        {viewMode === "tactical" ? (
          <TacticalCanvas />
        ) : viewMode === "status" ? (
          <StatusShipView />
        ) : viewMode === "debug" ? (
          <DebugSimulationView />
        ) : (
          <DebugLLMView />
        )}
      </Box>
    </Box>
  );
}
