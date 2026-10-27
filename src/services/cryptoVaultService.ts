/**
 * Client-Side WebCrypto AES-GCM-256 Vault Service.
 * Protects user API keys (OpenRouter, Gemini, OpenAI, Claude, Ollama)
 * with a master passphrase. Plaintext keys are never sent to any server.
 */

export interface EncryptedPayload {
  version: 1;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

export interface AiProviderConfig {
  activeProvider: 'openrouter' | 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'offline';
  openRouterKey?: string;
  openRouterModel?: string;
  geminiKey?: string;
  geminiModel?: string;
  openAiKey?: string;
  openAiModel?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

const VAULT_STORAGE_KEY = 'flowtask_encrypted_ai_vault_v1';
const LOCAL_CONFIG_CACHE_KEY = 'flowtask_ai_config_local_v1';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptConfig(
  config: AiProviderConfig,
  passphrase: string
): Promise<EncryptedPayload> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(config));

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    version: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
  };
}

export async function decryptConfig(
  payload: EncryptedPayload,
  passphrase: string
): Promise<AiProviderConfig> {
  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted)) as AiProviderConfig;
}

export function saveLocalAiConfig(config: AiProviderConfig): void {
  try {
    localStorage.setItem(LOCAL_CONFIG_CACHE_KEY, JSON.stringify(config));
  } catch {}
}

export function loadLocalAiConfig(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(LOCAL_CONFIG_CACHE_KEY);
    if (raw) return JSON.parse(raw) as AiProviderConfig;
  } catch {}

  return {
    activeProvider: 'offline',
    ollamaUrl: 'http://localhost:11434',
    openRouterModel: 'anthropic/claude-3.5-sonnet',
    geminiModel: 'gemini-2.5-flash',
    openAiModel: 'gpt-4o-mini',
    anthropicModel: 'claude-3-5-sonnet-20241022',
    ollamaModel: 'llama3.2',
  };
}

export function saveEncryptedVault(payload: EncryptedPayload): void {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

export function loadEncryptedVault(): EncryptedPayload | null {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as EncryptedPayload;
  } catch {}
  return null;
}
