import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";

type ProviderProps = {
  children: ReactNode;
};

// @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-002
export function Provider({ children }: ProviderProps) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ThemeProvider attribute="class" disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
