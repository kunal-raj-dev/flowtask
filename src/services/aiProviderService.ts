/**
 * Multi-Provider AI Engine for FlowTask.
 * Integrates OpenRouter, Google Gemini, OpenAI, Anthropic Claude, and local Ollama.
 * Falls back to client-side deterministic heuristics when offline or when no key is set.
 */

import { loadLocalAiConfig, type AiProviderConfig } from './cryptoVaultService';
import { suggestSubtasks, generateStarterStep, type SuggestedSubtask } from '../utils/aiCopilot';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiDecompositionResult {
  steps: SuggestedSubtask[];
  starterStep: string;
  providerUsed: string;
}

export interface MorningBriefingResult {
  headline: string;
  focusPlan: string[];
  strategicAlignmentInsight: string;
  suggestedSchedule: Array<{ time: string; activity: string }>;
}

export class AiProviderService {
  private config: AiProviderConfig;

  constructor(customConfig?: AiProviderConfig) {
    this.config = customConfig || loadLocalAiConfig();
  }

  public setConfig(newConfig: AiProviderConfig): void {
    this.config = newConfig;
  }

  public getConfig(): AiProviderConfig {
    return this.config;
  }

  /**
   * Decomposes any complex task into 3-6 actionable physical next steps.
   */
  public async decomposeTask(
    title: string,
    description?: string,
    signal?: AbortSignal
  ): Promise<AiDecompositionResult> {
    const provider = this.config.activeProvider;

    // Fast-path: Offline or no provider set
    if (provider === 'offline') {
      return {
        steps: suggestSubtasks(title, description),
        starterStep: generateStarterStep(title, description),
        providerUsed: 'Local Heuristics (Offline)',
      };
    }

    const systemPrompt = `You are a world-class executive productivity coach. 
Break the user's task into 3 to 5 concrete, actionable, physical next steps.
Format your response strictly as valid JSON:
{
  "starterStep": "Exact 2-minute physical starter step to overcome procrastination",
  "steps": [
    { "title": "Concrete physical micro-action", "estimatedMinutes": 20 }
  ]
}`;

    const userPrompt = `Task: "${title}"${description ? `\nContext/Notes: "${description}"` : ''}`;

    try {
      const responseText = await this.queryProvider(
        provider,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        signal
      );

      // Clean JSON delimiters if markdown wrapped
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          starterStep?: string;
          steps: Array<{ title: string; estimatedMinutes?: number }>;
        };
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return {
            steps: parsed.steps,
            starterStep: parsed.starterStep || generateStarterStep(title, description),
            providerUsed: provider.toUpperCase(),
          };
        }
      }
    } catch {
      // Graceful fallback to offline heuristics on network or rate limit failure
    }

    return {
      steps: suggestSubtasks(title, description),
      starterStep: generateStarterStep(title, description),
      providerUsed: 'Local Heuristics (Fallback)',
    };
  }

  /**
   * Multi-turn chat assistant query.
   */
  public async queryChat(
    messages: ChatMessage[],
    systemContext?: string,
    signal?: AbortSignal
  ): Promise<string> {
    const provider = this.config.activeProvider;

    const fullMessages: ChatMessage[] = [];
    if (systemContext) {
      fullMessages.push({
        role: 'system',
        content: `You are FlowTask Copilot, an elite personal chief of staff. 
Help the user organize their day, prioritize their tasks, and align their daily actions with their strategic life goals.
Be concise, actionable, and encouraging without cheesy fluff.
${systemContext}`,
      });
    }

    fullMessages.push(...messages);

    if (provider === 'offline') {
      return (
        'You are currently in Offline Mode. To activate live AI chat with OpenRouter, Gemini, OpenAI, Claude, or Ollama, configure your API key in Settings → AI Copilot.'
      );
    }

    return this.queryProvider(provider, fullMessages, signal);
  }

  /**
   * Internal dispatcher for API providers.
   */
  private async queryProvider(
    provider: AiProviderConfig['activeProvider'],
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    switch (provider) {
      case 'openrouter': {
        const apiKey = this.config.openRouterKey;
        if (!apiKey) throw new Error('OpenRouter API key is not configured.');
        const model = this.config.openRouterModel || 'anthropic/claude-3.5-sonnet';

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://flowtask.app',
            'X-Title': 'FlowTask',
          },
          body: JSON.stringify({ model, messages }),
          signal,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenRouter error (${res.status}): ${err}`);
        }

        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content || '';
      }

      case 'gemini': {
        const apiKey = this.config.geminiKey;
        if (!apiKey) throw new Error('Gemini API key is not configured.');
        const model = this.config.geminiModel || 'gemini-2.5-flash';

        // Format for Gemini REST API
        const contents = messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
            signal,
          }
        );

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Gemini error (${res.status}): ${err}`);
        }

        const data = (await res.json()) as {
          candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
        };
        return data.candidates[0]?.content?.parts[0]?.text || '';
      }

      case 'openai': {
        const apiKey = this.config.openAiKey;
        if (!apiKey) throw new Error('OpenAI API key is not configured.');
        const model = this.config.openAiModel || 'gpt-4o-mini';

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, messages }),
          signal,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`OpenAI error (${res.status}): ${err}`);
        }

        const data = (await res.json()) as {
          choices: Array<{ message: { content: string } }>;
        };
        return data.choices[0]?.message?.content || '';
      }

      case 'anthropic': {
        const apiKey = this.config.anthropicKey;
        if (!apiKey) throw new Error('Anthropic API key is not configured.');
        const model = this.config.anthropicModel || 'claude-3-5-sonnet-20241022';

        const system = messages.find((m) => m.role === 'system')?.content || '';
        const nonSystem = messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'dangerously-allow-browser': 'true',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            system,
            messages: nonSystem,
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Anthropic error (${res.status}): ${err}`);
        }

        const data = (await res.json()) as {
          content: Array<{ text: string }>;
        };
        return data.content[0]?.text || '';
      }

      case 'ollama': {
        const baseUrl = this.config.ollamaUrl || 'http://localhost:11434';
        const model = this.config.ollamaModel || 'llama3.2';

        const res = await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: false }),
          signal,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Ollama error (${res.status}): ${err}`);
        }

        const data = (await res.json()) as { message: { content: string } };
        return data.message?.content || '';
      }

      default:
        return 'No provider selected.';
    }
  }
}

export const aiProviderService = new AiProviderService();
