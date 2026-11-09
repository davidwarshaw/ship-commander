import { FormEvent, useEffect, useState } from "react";
import { Accordion, Box, Button, HStack, Heading, Input, List, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { TacticalCanvas } from "./tactical/TacticalCanvas";
import { StatusShipView } from "./status/StatusShipView";
import { useCommanderStore } from "./state/store";
import { CrewTag } from "./components/CrewTag";
import { getBridgeCrewDefinition, resolveCrewMemberBySpeakerToken } from "./crew/crewCatalog";

// @spec PRESENT-CHAKRA-006, PRESENT-CHAKRA-008, PRESENT-CHAKRA-009, PRESENT-SET-001, PRESENT-BIND-009, PRESENT-BIND-010, PRESENT-LOG-004, PRESENT-LOG-005, PRESENT-LOG-006
export function App() {
  const [commandDraft, setCommandDraft] = useState("");
  const isLockOwner = useCommanderStore((s) => s.isLockOwner);
  const viewMode = useCommanderStore((s) => s.viewMode);
  const commandLog = useCommanderStore((s) => s.commandLog);
  const simulationTimeMinutes = useCommanderStore((s) => s.simulationTimeMinutes);
  const llmSettings = useCommanderStore((s) => s.llmSettings);
  const apiKeyInput = useCommanderStore((s) => s.apiKeyInput);
  const settingsNotice = useCommanderStore((s) => s.settingsNotice);
  const unsavedLLMSettings = useCommanderStore((s) => s.unsavedLLMSettings);
  const initializeSessionLock = useCommanderStore((s) => s.initializeSessionLock);
  const setViewMode = useCommanderStore((s) => s.setViewMode);
  const setLLMProvider = useCommanderStore((s) => s.setLLMProvider);
  const setLLMModel = useCommanderStore((s) => s.setLLMModel);
  const setLLMApiKeyInput = useCommanderStore((s) => s.setLLMApiKeyInput);
  const saveLLMSettings = useCommanderStore((s) => s.saveLLMSettings);
  const submitCommand = useCommanderStore((s) => s.submitCommand);
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
        ? ["claude-3-5-sonnet-latest"]
        : [];

  return (
    <Box className="app-shell">
      <Box as="aside" className="command-panel">
        <Accordion.Root collapsible defaultValue={[]} className="command-form">
          <Accordion.Item value="settings">
            <Accordion.ItemTrigger>
              <Text>Settings</Text>
              <Accordion.ItemIndicator />
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <Accordion.ItemBody>
                <VStack align="stretch">
                  {settingsNotice ? (
                    <Text>
                      <Text as="span" className="warning-pill">
                        {settingsNotice}
                      </Text>
                    </Text>
                  ) : null}
                  <Text as="label" htmlFor="provider-select">
                    LLM Provider
                  </Text>
                  <NativeSelect.Root disabled={!isLockOwner}>
                    <NativeSelect.Field id="provider-select" value={llmSettings.providerId} onChange={(e) => setLLMProvider(e.target.value)}>
                      <option value="mock-local">mock-local</option>
                      <option value="anthropic-claude">anthropic-claude</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Text as="label" htmlFor="model-select">
                    Model
                  </Text>
                  <NativeSelect.Root disabled={!isLockOwner}>
                    <NativeSelect.Field id="model-select" value={llmSettings.modelId} onChange={(e) => setLLMModel(e.target.value)}>
                      {modelOptions.map((modelId) => (
                        <option key={modelId} value={modelId}>
                          {modelId}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Text as="label" htmlFor="api-key-input">
                    API Key
                  </Text>
                  <Input
                    id="api-key-input"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setLLMApiKeyInput(e.target.value)}
                    placeholder={llmSettings.apiKey ? "••••••••" : "Enter API key"}
                    disabled={!isLockOwner}
                  />
                  <Button className="action-btn" type="button" onClick={saveLLMSettings} disabled={!isLockOwner}>
                    Save settings
                  </Button>
                  {unsavedLLMSettings ? <Text>LLM settings draft is unsaved.</Text> : null}
                </VStack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
        <Text className="simulation-time">
          Simulation time:{" "}
          <Text as="strong">
            {hours}:{minutes}
          </Text>
        </Text>
        <Heading as="h2" size="md">
          Bridge Crew
        </Heading>
        <List.Root className="command-list">
          {bridgeCrew ? (
            bridgeCrew.crew.map((member) => (
              <List.Item key={member.name}>
                <CrewTag member={member} />
              </List.Item>
            ))
          ) : (
            <List.Item>Bridge crew unavailable.</List.Item>
          )}
        </List.Root>
        <Heading as="h2" size="md">
          Command Log
        </Heading>
        <List.Root className="command-list">
          {commandLog.map((line) => {
            const [rawSpeaker, ...messageParts] = line.text.split(":");
            const hasSpeakerToken = messageParts.length > 0;
            if (!bridgeCrew || !hasSpeakerToken) {
              return <List.Item key={line.id}>{line.text}</List.Item>;
            }
            const member = resolveCrewMemberBySpeakerToken(bridgeCrew, rawSpeaker);
            if (!member) {
              return <List.Item key={line.id}>{line.text}</List.Item>;
            }
            const message = messageParts.join(":").trim();
            return (
              <List.Item key={line.id}>
                <CrewTag member={member} />: {message}
              </List.Item>
            );
          })}
        </List.Root>
        <Box as="form" className="command-form command-form-bottom" onSubmit={onSubmitCommand}>
          <Text as="label" htmlFor="command-input">
            Captain command
          </Text>
          <HStack className="command-form-row">
            <Input
              id="command-input"
              value={commandDraft}
              onChange={(e) => setCommandDraft(e.target.value)}
              placeholder={isLockOwner ? "Issue a command..." : "Read-only tab"}
            />
            <Button type="submit" className="action-btn">
              Send
            </Button>
          </HStack>
        </Box>
      </Box>
      <Box as="main" className="tactical-panel">
        <HStack className="view-mode-toggle">
          <Button
            className={viewMode === "tactical" ? "action-btn selected" : "action-btn"}
            onClick={() => setViewMode("tactical")}
          >
            Tactical
          </Button>
          <Button
            className={viewMode === "status" ? "action-btn selected" : "action-btn"}
            onClick={() => setViewMode("status")}
          >
            Status
          </Button>
        </HStack>
        {viewMode === "tactical" ? (
          <TacticalCanvas />
        ) : (
          <StatusShipView />
        )}
      </Box>
    </Box>
  );
}
