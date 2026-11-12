import { getSettings } from "./database";

let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;
let lastCopiedValue: string | null = null;

/**
 * Copies text to the system clipboard and schedules an automatic clear
 * after the configured delay if the clipboard still contains the copied value.
 */
export async function copyToClipboardWithAutoClear(
  text: string,
  customDelaySeconds?: number,
): Promise<boolean> {
  if (!text) return false;

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (typeof document !== "undefined") {
      const input = document.createElement("input");
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    } else {
      return false;
    }

    lastCopiedValue = text;

    if (clipboardClearTimer) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }

    let delaySeconds = customDelaySeconds;
    if (typeof delaySeconds !== "number") {
      try {
        const settings = await getSettings();
        delaySeconds = settings.clipboardClearDelay ?? 30;
      } catch {
        delaySeconds = 30;
      }
    }

    if (delaySeconds > 0) {
      clipboardClearTimer = setTimeout(async () => {
        try {
          if (
            typeof navigator !== "undefined" &&
            navigator.clipboard?.readText
          ) {
            const currentClip = await navigator.clipboard
              .readText()
              .catch(() => null);
            // Only clear if the user hasn't copied something else in another application
            if (currentClip === lastCopiedValue) {
              await navigator.clipboard.writeText("");
            }
          }
        } catch {
          // Gracefully ignore clipboard read permissions restriction
        } finally {
          lastCopiedValue = null;
          clipboardClearTimer = null;
        }
      }, delaySeconds * 1000);
    }

    return true;
  } catch {
    return false;
  }
}

export function cancelClipboardAutoClear(): void {
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }
  lastCopiedValue = null;
}
