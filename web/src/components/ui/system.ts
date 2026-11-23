import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    textStyles: {
      body: {
        value: {
          fontSize: "0.95rem",
          lineHeight: "1.45",
          fontWeight: "400"
        }
      },
      caption: {
        value: {
          fontSize: "0.72rem",
          lineHeight: "1.2",
          fontWeight: "600",
          letterSpacing: "0.04em",
          textTransform: "uppercase"
        }
      },
      header: {
        value: {
          fontSize: "0.86rem",
          lineHeight: "1.25",
          fontWeight: "700",
          letterSpacing: "0.02em",
          textTransform: "uppercase"
        }
      }
    }
  }
});

export const shipCommanderSystem = createSystem(defaultConfig, config);
