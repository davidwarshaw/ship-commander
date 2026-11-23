import { ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { shipCommanderSystem } from "./system";

type ProviderProps = {
  children: ReactNode;
};

// @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-002
export function Provider({ children }: ProviderProps) {
  return (
    <ChakraProvider value={shipCommanderSystem}>
      <ThemeProvider attribute="class" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
