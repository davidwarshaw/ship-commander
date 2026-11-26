import { Accordion, Box, Heading, Text } from "@chakra-ui/react";
import { useCommanderStore } from "../state/store";

function formatUnknown(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// @spec PRESENT-DBG-012, PRESENT-DBG-013, PRESENT-DBG-014
export function DebugSystemsView() {
  const systemDebugSnapshot = useCommanderStore((s) => s.systemDebugSnapshot);

  return (
    <Box className="debug-systems-view">
      <Heading as="h2" size="md" textStyle="header">
        System Debug
      </Heading>
      <Text textStyle="body">systems: {systemDebugSnapshot.systems.length}</Text>
      {systemDebugSnapshot.systems.length === 0 ? (
        <Text textStyle="body">No crewed systems registered.</Text>
      ) : (
        <Accordion.Root collapsible multiple className="debug-systems-list">
          {systemDebugSnapshot.systems.map((system) => (
            <Accordion.Item key={system.systemName} value={system.systemName}>
              <Accordion.ItemTrigger>
                <Text textStyle="body">{system.systemName}</Text>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Text textStyle="body">crew: {system.assignedCrew}</Text>
                  <Text textStyle="caption">actions:</Text>
                  {system.actions.map((action) => (
                    <Text key={action.name} textStyle="caption">
                      - {action.name}: {action.description}
                    </Text>
                  ))}
                  <Text textStyle="caption">internalState:</Text>
                  <Text as="pre" textStyle="caption" className="debug-systems-state">
                    {formatUnknown(system.internalState)}
                  </Text>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </Box>
  );
}
