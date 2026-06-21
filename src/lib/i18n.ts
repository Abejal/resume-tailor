import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import ms from "@/locales/ms.json";

const STORAGE_KEY = "jobtailor_locale";

const initial = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ms: { translation: ms },
  },
  lng: initial,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export function setLocale(locale: "en" | "ms") {
  i18n.changeLanguage(locale);
  localStorage.setItem(STORAGE_KEY, locale);
}

export default i18n;
