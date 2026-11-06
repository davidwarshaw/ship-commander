import { FormEvent, useEffect, useState } from "react";
import { Accordion, Button, HStack, Input, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { TacticalCanvas } from "./tactical/TacticalCanvas";
import { useCommanderStore } from "./state/store";

// @spec PRESENT-CHAKRA-006, PRESENT-SET-001
export function App() {
  const [commandDraft, setCommandDraft] = useState("");
  const sessionTabId = useCommanderStore((s) => s.sessionTabId);
  const lockOwnerTabId = useCommanderStore((s) => s.lockOwnerTabId);
  const isLockOwner = useCommanderStore((s) => s.isLockOwner);
  const viewMode = useCommanderStore((s) => s.viewMode);
  const commandLog = useCommanderStore((s) => s.commandLog);
  const systemStatus = useCommanderStore((s) => s.systemStatus);
  const simTick = useCommanderStore((s) => s.simTick);
  const simulationTimeMinutes = useCommanderStore((s) => s.simulationTimeMinutes);
  const projectionSnapshotTick = useCommanderStore((s) => s.projectionSnapshotTick);
  const staleProjection = useCommanderStore((s) => s.staleProjection);
  const droppedFrames = useCommanderStore((s) => s.renderFramesDropped);
  const llmSettings = useCommanderStore((s) => s.llmSettings);
  const apiKeyInput = useCommanderStore((s) => s.apiKeyInput);
  const settingsNotice = useCommanderStore((s) => s.settingsNotice);
  const unsavedLLMSettings = useCommanderStore((s) => s.unsavedLLMSettings);
  const initializeSessionLock = useCommanderStore((s) => s.initializeSessionLock);
  const claimWriterLock = useCommanderStore((s) => s.claimWriterLock);
  const setViewMode = useCommanderStore((s) => s.setViewMode);
  const setLLMProvider = useCommanderStore((s) => s.setLLMProvider);
  const setLLMModel = useCommanderStore((s) => s.setLLMModel);
  const setLLMApiKeyInput = useCommanderStore((s) => s.setLLMApiKeyInput);
  const saveLLMSettings = useCommanderStore((s) => s.saveLLMSettings);
  const submitCommand = useCommanderStore((s) => s.submitCommand);

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
    <div className="app-shell">
      <aside className="command-panel">
        <h1>Ship Commander</h1>
        <p>
          Session tab: <code>{sessionTabId}</code>
        </p>
        <p>
          Lock owner: <code>{lockOwnerTabId ?? "none"}</code> {isLockOwner ? "(writer)" : "(read-only)"}
        </p>
        <p>
          Sim tick: <strong>{simTick}</strong> • Dropped render frames: <strong>{droppedFrames}</strong>
        </p>
        <p>
          Simulation time:{" "}
          <strong>
            {hours}:{minutes}
          </strong>
        </p>
        <p>
          Projection tick: <strong>{projectionSnapshotTick}</strong>{" "}
          {staleProjection ? <span className="warning-pill">Stale projection</span> : <span className="ok-pill">Synced</span>}
        </p>
        {!isLockOwner ? (
          <Button className="action-btn" onClick={claimWriterLock}>
            Claim writer lock
          </Button>
        ) : null}
        <form className="command-form" onSubmit={onSubmitCommand}>
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
        </form>
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
                    <p>
                      <span className="warning-pill">{settingsNotice}</span>
                    </p>
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
                  {unsavedLLMSettings ? <p>LLM settings draft is unsaved.</p> : null}
                </VStack>
              </Accordion.ItemBody>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
        <div className="mode-toggle">
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
        </div>
        <h2>Command Log</h2>
        <ul>
          {commandLog.map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ul>
        <h2>Systems</h2>
        <ul>
          {Object.entries(systemStatus).map(([name, value]) => (
            <li key={name}>
              {name}: {value}
            </li>
          ))}
        </ul>
      </aside>
      <main className="tactical-panel">
        {viewMode === "tactical" ? (
          <TacticalCanvas />
        ) : (
          <div className="status-mode">
            <h2>Systems / Status View</h2>
            <ul>
              {Object.entries(systemStatus).map(([name, value]) => (
                <li key={name}>
                  {name}: {value}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
