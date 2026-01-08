// /lib/presets.ts
import data from "./presets.json";

export type Preset = {
  id: string;
  name: string;
  prompt: string;
};

export const PRESETS: readonly Preset[] = Object.freeze(data as Preset[]);
