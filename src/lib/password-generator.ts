export const PASSWORD_LENGTH_PRESETS = [32, 64, 128, 256] as const;
export type PasswordLengthPreset = (typeof PASSWORD_LENGTH_PRESETS)[number];

export const CHARSET_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const CHARSET_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
export const CHARSET_NUMBERS = '0123456789';
export const CHARSET_SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?~';

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordGeneratorOptions = {
  length: 32,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: false,
};

const STORAGE_PASSWORD_KEY = 'secureauth_saved_password_v2';
const STORAGE_OPTIONS_KEY = 'secureauth_saved_password_options_v2';
const LEGACY_STORAGE_PASSWORD_KEY = 'secureauth_saved_password';

export function generatePassword(options: Partial<PasswordGeneratorOptions> = {}): string {
  const opts: PasswordGeneratorOptions = {
    ...DEFAULT_PASSWORD_OPTIONS,
    ...options,
  };

  const length = Math.max(32, Math.min(256, Number(opts.length) || 32));

  let pool = '';
  const requiredChars: string[] = [];

  const addCharFromSet = (charset: string) => {
    const randomBytes = new Uint32Array(1);
    crypto.getRandomValues(randomBytes);
    const index = randomBytes[0] % charset.length;
    requiredChars.push(charset[index]);
  };

  if (opts.uppercase) {
    pool += CHARSET_UPPERCASE;
    addCharFromSet(CHARSET_UPPERCASE);
  }
  if (opts.lowercase) {
    pool += CHARSET_LOWERCASE;
    addCharFromSet(CHARSET_LOWERCASE);
  }
  if (opts.numbers) {
    pool += CHARSET_NUMBERS;
    addCharFromSet(CHARSET_NUMBERS);
  }
  if (opts.symbols) {
    pool += CHARSET_SYMBOLS;
    addCharFromSet(CHARSET_SYMBOLS);
  }

  if (pool.length === 0) {
    pool = CHARSET_UPPERCASE + CHARSET_LOWERCASE + CHARSET_NUMBERS + CHARSET_SYMBOLS;
    addCharFromSet(CHARSET_UPPERCASE);
    addCharFromSet(CHARSET_LOWERCASE);
    addCharFromSet(CHARSET_NUMBERS);
    addCharFromSet(CHARSET_SYMBOLS);
  }

  const remainingLength = Math.max(0, length - requiredChars.length);
  const chars: string[] = [...requiredChars];

  if (remainingLength > 0) {
    const randomBuffer = new Uint32Array(remainingLength);
    crypto.getRandomValues(randomBuffer);
    for (let i = 0; i < remainingLength; i++) {
      const charIndex = randomBuffer[i] % pool.length;
      chars.push(pool[charIndex]);
    }
  }

  const shuffleBuffer = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffleBuffer);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBuffer[i] % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.slice(0, length).join('');
}

const inMemoryStorage = new Map<string, string>();

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function getStorageItem(key: string): string | null {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      return inMemoryStorage.get(key) ?? null;
    }
  }
  return inMemoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch {
      // empty
    }
  }
  inMemoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // empty
    }
  }
  inMemoryStorage.delete(key);
}

export function getSessionPassword(): string | null {
  return (
    getStorageItem(STORAGE_PASSWORD_KEY) ||
    getStorageItem(LEGACY_STORAGE_PASSWORD_KEY)
  );
}

export function setSessionPassword(password: string): void {
  setStorageItem(STORAGE_PASSWORD_KEY, password);
  setStorageItem(LEGACY_STORAGE_PASSWORD_KEY, password);
}

export function clearSessionPassword(): void {
  removeStorageItem(STORAGE_PASSWORD_KEY);
  removeStorageItem(LEGACY_STORAGE_PASSWORD_KEY);
}

export function getSessionPasswordOptions(): PasswordGeneratorOptions {
  try {
    const raw = getStorageItem(STORAGE_OPTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PASSWORD_OPTIONS,
        ...parsed,
      };
    }
  } catch {
    return DEFAULT_PASSWORD_OPTIONS;
  }
  return DEFAULT_PASSWORD_OPTIONS;
}

export function setSessionPasswordOptions(options: PasswordGeneratorOptions): void {
  try {
    setStorageItem(STORAGE_OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // empty
  }
}


