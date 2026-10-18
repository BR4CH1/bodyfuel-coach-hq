import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type StorageMetadata = { version: string; chunks: number };

const CHUNK_SIZE = 1_800;

function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

function metadataKey(key: string): string {
  return `${safeKey(key)}.__meta`;
}

function chunkKey(key: string, version: string, index: number): string {
  return `${safeKey(key)}.${version}.${index}`;
}

function browserStorage() {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return browserStorage()?.getItem(key) ?? null;

    const rawMetadata = await SecureStore.getItemAsync(metadataKey(key));
    if (!rawMetadata) return SecureStore.getItemAsync(safeKey(key));

    try {
      const metadata = JSON.parse(rawMetadata) as StorageMetadata;
      if (!metadata.version || !Number.isInteger(metadata.chunks) || metadata.chunks < 1) return null;

      const chunks = await Promise.all(
        Array.from({ length: metadata.chunks }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(key, metadata.version, index)),
        ),
      );
      return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      browserStorage()?.setItem(key, value);
      return;
    }

    const oldMetadataRaw = await SecureStore.getItemAsync(metadataKey(key));
    let oldMetadata: StorageMetadata | null = null;
    if (oldMetadataRaw) {
      try {
        const parsed = JSON.parse(oldMetadataRaw) as Partial<StorageMetadata>;
        if (parsed.version && Number.isInteger(parsed.chunks) && Number(parsed.chunks) > 0) {
          oldMetadata = { version: parsed.version, chunks: Number(parsed.chunks) };
        }
      } catch {
        // The new value below replaces malformed legacy metadata.
      }
    }
    const version = Date.now().toString(36);
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];

    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, version, index), chunk)),
    );
    await SecureStore.setItemAsync(metadataKey(key), JSON.stringify({ version, chunks: chunks.length }));
    await SecureStore.deleteItemAsync(safeKey(key));

    if (oldMetadata?.version) {
      await Promise.all(
        Array.from({ length: oldMetadata.chunks }, (_, index) =>
          SecureStore.deleteItemAsync(chunkKey(key, oldMetadata.version, index)),
        ),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      browserStorage()?.removeItem(key);
      return;
    }

    const rawMetadata = await SecureStore.getItemAsync(metadataKey(key));
    if (rawMetadata) {
      try {
        const metadata = JSON.parse(rawMetadata) as StorageMetadata;
        await Promise.all(
          Array.from({ length: metadata.chunks }, (_, index) =>
            SecureStore.deleteItemAsync(chunkKey(key, metadata.version, index)),
          ),
        );
      } catch {
        // Removing the metadata below still invalidates a malformed entry.
      }
    }

    await Promise.all([
      SecureStore.deleteItemAsync(metadataKey(key)),
      SecureStore.deleteItemAsync(safeKey(key)),
    ]);
  },
};
