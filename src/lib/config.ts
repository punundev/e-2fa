const CONFIG_STORAGE_KEY = 'secureauth_config';

export interface AppConfig {
  apiBaseUrl: string;
  isSelfHosted: boolean;
}

export const DEFAULT_CONFIG: AppConfig = {
  apiBaseUrl: 'https://api.secureauth.dev', // Can be customized to local or self-hosted server
  isSelfHosted: false,
};

export async function getAppConfig(): Promise<AppConfig> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG_STORAGE_KEY], (res) => {
        resolve((res[CONFIG_STORAGE_KEY] as AppConfig) || DEFAULT_CONFIG);
      });
    });
  }

  const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config }, () => resolve());
    });
  }
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}
