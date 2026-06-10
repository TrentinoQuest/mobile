import { registerPlugin } from '@capacitor/core';

/**
 * Mock in-memory del plugin Preferences per i test unitari Karma.
 *
 * Perche' serve: il proxy creato da registerPlugin() ignora completamente
 * il target, quindi jasmine spyOn(Preferences, 'get') non intercetta nulla
 * e le chiamate reali tentano l'import dinamico dell'implementazione web
 * (chunk che Karma non riesce a servire -> ChunkLoadError).
 *
 * Soluzione: registerPlugin() e' first-wins (registrazioni successive con
 * lo stesso nome restituiscono il proxy gia' creato). Registrando QUI il
 * plugin 'Preferences' con un'implementazione web sincrona in-memory,
 * l'import di @capacitor/preferences nei service riusa questo mock.
 *
 * Va chiamato da src/test.ts PRIMA che venga importato qualsiasi modulo
 * applicativo.
 */

/** Store ispezionabile dai test (es. assert su persistenza). */
export const preferencesStore = new Map<string, string>();

export function installCapacitorTestMocks(): void {
  registerPlugin('Preferences', {
    web: {
      get: async ({ key }: { key: string }) => ({
        value: preferencesStore.get(key) ?? null,
      }),
      set: async ({ key, value }: { key: string; value: string }) => {
        preferencesStore.set(key, value);
      },
      remove: async ({ key }: { key: string }) => {
        preferencesStore.delete(key);
      },
      clear: async () => {
        preferencesStore.clear();
      },
      keys: async () => ({ keys: [...preferencesStore.keys()] }),
      configure: async () => undefined,
      migrate: async () => ({ migrated: [], existing: [] }),
      removeOld: async () => undefined,
    },
  });
}
