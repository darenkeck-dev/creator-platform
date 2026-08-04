export const TONE_EXPLORER_EXPLAINED_KEY = "darenkeck:tone-explorer-explained:v1";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function hasAcknowledgedToneExplorer(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(TONE_EXPLORER_EXPLAINED_KEY) === "1";
  } catch {
    return false;
  }
}

export function acknowledgeToneExplorer(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(TONE_EXPLORER_EXPLAINED_KEY, "1");
  } catch {
    // The explainer still works when browser privacy settings block persistence.
  }
}
