import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useAuthStore = create((set, get) => ({
  token: null,
  user: null,
  isLoading: true,

  init: async () => {
    try {
      const raw = await AsyncStorage.getItem("auth");
      if (raw) {
        const { token, user } = JSON.parse(raw);
        set({ token, user });
      }
    } catch {}
    set({ isLoading: false });
  },

  login: async (token, user) => {
    await AsyncStorage.setItem("auth", JSON.stringify({ token, user }));
    set({ token, user });
  },

  logout: async () => {
    await AsyncStorage.removeItem("auth");
    set({ token: null, user: null });
  },
}));
