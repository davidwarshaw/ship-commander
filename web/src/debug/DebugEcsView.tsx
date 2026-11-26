import { Accordion, Box, Heading, Text } from "@chakra-ui/react";
import { useCommanderStore } from "../state/store";

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : String(value);
}

// @spec PRESENT-DBG-001, PRESENT-DBG-002, PRESENT-DBG-003, PRESENT-DBG-004
export function DebugEcsView() {
  const ecsDebugSnapshot = useCommanderStore((s) => s.ecsDebugSnapshot);

  return (
    <Box className="debug-ecs-view">
      <Heading as="h2" size="md" textStyle="header">
        ECS Debug
      </Heading>
      <Text textStyle="body">entities: {ecsDebugSnapshot.entities.length}</Text>
      {ecsDebugSnapshot.entities.length === 0 ? (
        <Text textStyle="body">No ECS entities recorded yet.</Text>
      ) : (
        <Accordion.Root collapsible multiple className="debug-ecs-list">
          {ecsDebugSnapshot.entities.map((entity) => (
            <Accordion.Item
              key={`${entity.entityId}-${entity.label}`}
              value={`entity-${entity.entityId}`}
            >
              <Accordion.ItemTrigger>
                <Text textStyle="body">
                  {entity.label} [{entity.entityType}] (id={entity.entityId})
                </Text>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  <Accordion.Root collapsible multiple className="debug-ecs-component-list">
                    {entity.components.map((component) => (
                      <Accordion.Item
                        key={`${entity.entityId}-${component.componentName}`}
                        value={`${entity.entityId}-${component.componentName}`}
                      >
                        <Accordion.ItemTrigger>
                          <Text textStyle="body">{component.componentName}</Text>
                          <Accordion.ItemIndicator />
                        </Accordion.ItemTrigger>
                        <Accordion.ItemContent>
                          <Accordion.ItemBody>
                            <Text textStyle="caption">
                              x={formatNumber(component.data.x)} y=
                              {formatNumber(component.data.y)} z=
                              {formatNumber(component.data.z)}
                            </Text>
                          </Accordion.ItemBody>
                        </Accordion.ItemContent>
                      </Accordion.Item>
                    ))}
                  </Accordion.Root>
                </Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </Box>
  );
}
