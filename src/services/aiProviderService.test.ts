import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiProviderService } from './aiProviderService';

describe('AiProviderService', () => {
  let service: AiProviderService;

  beforeEach(() => {
    service = new AiProviderService({
      activeProvider: 'offline',
    });
    vi.restoreAllMocks();
  });

  it('decomposes tasks using offline heuristics when provider is offline', async () => {
    const result = await service.decomposeTask('Fix critical authentication crash on mobile safari');

    expect(result.providerUsed).toBe('Local Heuristics (Offline)');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.starterStep).toBeTruthy();
  });

  it('queries OpenRouter API when activeProvider is openrouter', async () => {
    service.setConfig({
      activeProvider: 'openrouter',
      openRouterKey: 'test-key',
      openRouterModel: 'anthropic/claude-3.5-sonnet',
    });

    const mockResponse = {
      choices: [
        {
          message: {
            content: '{"starterStep":"Open terminal and run tests","steps":[{"title":"Run local reproducer","estimatedMinutes":15}]}',
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as unknown as Response);

    const result = await service.decomposeTask('Deploy production v2');
    expect(result.providerUsed).toBe('OPENROUTER');
    expect(result.steps[0].title).toBe('Run local reproducer');
    expect(result.starterStep).toBe('Open terminal and run tests');
  });

  it('falls back gracefully to heuristics when network query fails', async () => {
    service.setConfig({
      activeProvider: 'gemini',
      geminiKey: 'test-gemini-key',
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await service.decomposeTask('Build landing page hero');
    expect(result.providerUsed).toBe('Local Heuristics (Fallback)');
    expect(result.steps.length).toBeGreaterThan(0);
  });
});
