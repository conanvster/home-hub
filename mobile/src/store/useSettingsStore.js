import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULTS = {
  localUrl: "http://192.168.1.34",
  features: {
    tracking: true,
    ha: true,
    kanban: true,
    chat: false,
    files: false,
  },
};

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,

  init: async () => {
    try {
      const raw = await AsyncStorage.getItem("settings");
      if (raw) set(JSON.parse(raw));
    } catch {}
  },

  setLocalUrl: async (url) => {
    const next = { ...get(), localUrl: url };
    set({ localUrl: url });
    await AsyncStorage.setItem("settings", JSON.stringify(next));
  },

  toggleFeature: async (key) => {
    const features = { ...get().features, [key]: !get().features[key] };
    const next = { ...get(), features };
    set({ features });
    await AsyncStorage.setItem("settings", JSON.stringify(next));
  },
}));
