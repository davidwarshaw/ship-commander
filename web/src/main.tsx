import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "@/components/ui/provider";
import { App } from "./App";
import "./styles.css";

// @spec PRESENT-CHAKRA-001, PRESENT-CHAKRA-002
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);
