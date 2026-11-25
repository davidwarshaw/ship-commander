export type OrderTestExpectation = {
  simTickDeltaAtLeast?: number;
  commandLogIncludes?: string[];
  systemStatusEquals?: Record<string, string>;
};

export type OrderTestStep = {
  id: string;
  order: string;
  waitMs?: number;
  expect?: OrderTestExpectation;
};

export type OrderTestScript = {
  id: string;
  name: string;
  steps: OrderTestStep[];
};
