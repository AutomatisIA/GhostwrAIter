import type { StrategyBundleInput } from "../schemas/strategy";

export type StrategyBundle = StrategyBundleInput & {
  profile: StrategyBundleInput["profile"] & {
    id?: string;
  };
  offers: Array<
    StrategyBundleInput["offers"][number] & {
      id?: string;
    }
  >;
  icps: Array<
    StrategyBundleInput["icps"][number] & {
      id?: string;
    }
  >;
  pillars: Array<
    StrategyBundleInput["pillars"][number] & {
      id?: string;
    }
  >;
  voiceRules: Array<
    StrategyBundleInput["voiceRules"][number] & {
      id?: string;
    }
  >;
};

export type StrategyApi = {
  getActiveBundle: () => Promise<StrategyBundle>;
  saveBundle: (bundle: StrategyBundleInput) => Promise<StrategyBundle>;
  generateFoundation: () => Promise<{
    summaryMarkdown: string;
  }>;
};
