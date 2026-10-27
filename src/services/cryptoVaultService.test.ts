import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptConfig,
  decryptConfig,
  saveLocalAiConfig,
  loadLocalAiConfig,
  type AiProviderConfig,
} from './cryptoVaultService';

describe('cryptoVaultService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('encrypts and decrypts AI config cleanly using WebCrypto AES-GCM', async () => {
    const config: AiProviderConfig = {
      activeProvider: 'gemini',
      geminiKey: 'AIzaSyTestKey12345',
      geminiModel: 'gemini-2.5-flash',
    };

    const passphrase = 'MyMasterSecretPassword2026!';
    const encrypted = await encryptConfig(config, passphrase);

    expect(encrypted.version).toBe(1);
    expect(encrypted.salt).toBeTruthy();
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.ciphertext).toBeTruthy();

    // Verify decryption with correct passphrase
    const decrypted = await decryptConfig(encrypted, passphrase);
    expect(decrypted.activeProvider).toBe('gemini');
    expect(decrypted.geminiKey).toBe('AIzaSyTestKey12345');
    expect(decrypted.geminiModel).toBe('gemini-2.5-flash');
  });

  it('fails decryption cleanly when given an invalid passphrase', async () => {
    const config: AiProviderConfig = {
      activeProvider: 'openrouter',
      openRouterKey: 'sk-or-v1-secret',
    };

    const encrypted = await encryptConfig(config, 'correct-passphrase');

    await expect(
      decryptConfig(encrypted, 'wrong-passphrase')
    ).rejects.toThrow();
  });

  it('saves and retrieves local fallback configuration', () => {
    const customConfig: AiProviderConfig = {
      activeProvider: 'ollama',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'deepseek-r1:8b',
    };

    saveLocalAiConfig(customConfig);
    const loaded = loadLocalAiConfig();

    expect(loaded.activeProvider).toBe('ollama');
    expect(loaded.ollamaUrl).toBe('http://localhost:11434');
    expect(loaded.ollamaModel).toBe('deepseek-r1:8b');
  });
});
