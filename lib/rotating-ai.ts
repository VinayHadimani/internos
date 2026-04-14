/**
 * CENTRAL AI KEY ROTATION & FALLBACK SYSTEM
 * 
 * This utility handles:
 * 1. Multi-provider fallback (Groq -> Gemini -> OpenAI)
 * 2. Key rotation (Least Recently Used)
 * 3. Rate limit recovery (429 handling)
 * 4. Automatic cleanup of failed keys
 */

// Store key usage and rate limits
const keyUsage = new Map<string, { lastUsed: number; failures: number }>();
const RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown after failure

interface AICallOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
  providerPriority?: ('groq' | 'gemini' | 'openai')[];
}

interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  provider?: string;
  model?: string;
}

// Get API keys from environment (comma-separated or JSON array)
function getKeys(keyName: string): string[] {
  const keys = process.env[keyName];
  if (!keys) {
    // Fallback to single key if plural version is missing
    const singleKeyName = keyName.endsWith('S') ? keyName.slice(0, -1) : keyName;
    const singleKey = process.env[singleKeyName];
    return singleKey ? [singleKey.trim()] : [];
  }
  
  if (keys.startsWith('[')) {
    try {
      return JSON.parse(keys);
    } catch (e) {
      console.error(`Error parsing JSON keys for ${keyName}:`, e);
      return [];
    }
  }
  return keys.split(',').map(k => k.trim()).filter(Boolean);
}

// Get best available key (least recently used, not in cooldown)
function getBestKey(keys: string[]): string | null {
  const now = Date.now();
  
  const availableKeys = keys.filter(key => {
    const usage = keyUsage.get(key);
    if (!usage) return true;
    if (usage.failures >= 3) {
      if (now - usage.lastUsed < RATE_LIMIT_COOLDOWN) return false;
      usage.failures = 0; // Reset after cooldown
      return true;
    }
    return true;
  });
  
  if (availableKeys.length === 0) return null;
  
  availableKeys.sort((a, b) => {
    const aTime = keyUsage.get(a)?.lastUsed || 0;
    const bTime = keyUsage.get(b)?.lastUsed || 0;
    return aTime - bTime;
  });
  
  return availableKeys[0];
}

function markKeyUsed(key: string) {
  const current = keyUsage.get(key) || { lastUsed: 0, failures: 0 };
  keyUsage.set(key, { lastUsed: Date.now(), failures: current.failures });
}

function markKeyFailed(key: string) {
  const current = keyUsage.get(key) || { lastUsed: Date.now(), failures: 0 };
  keyUsage.set(key, { lastUsed: Date.now(), failures: current.failures + 1 });
}

// ==========================================
// PROVIDER WRAPPERS
// ==========================================

async function groqCall(apiKey: string, system: string, user: string, options: AICallOptions): Promise<string> {
  const Groq = (await import('groq-sdk')).default;
  const groq = new Groq({ apiKey });
  
  const completion = await groq.chat.completions.create({
    model: options.model || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens || 2500,
    response_format: options.response_format as any
  });
  
  return completion.choices[0]?.message?.content || '';
}

async function geminiCall(apiKey: string, system: string, user: string, options: AICallOptions): Promise<string> {
  // Map models to Gemini compatible names if needed
  let model = options.model || 'gemini-2.0-flash';
  if (model.includes('llama')) model = 'gemini-2.0-flash';
  if (model.includes('gpt')) model = 'gemini-2.0-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${system}\n\nUSER INPUT:\n${user}` }]
        }],
        generationConfig: { 
          temperature: options.temperature ?? 0.2, 
          maxOutputTokens: options.max_tokens || 2500 
        }
      })
    }
  );
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Gemini Error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function openaiCall(apiKey: string, system: string, user: string, options: AICallOptions): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });
  
  const completion = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens || 2500,
    response_format: options.response_format as any
  });
  
  return completion.choices[0]?.message?.content || '';
}

// ==========================================
// MAIN RE-EXPORTED FUNCTION
// ==========================================

export async function callAI(
  systemMessage: string,
  userMessage: string,
  options: AICallOptions = {}
): Promise<AIResponse> {
  const providerOrder = options.providerPriority || ['groq', 'gemini', 'openai'];
  
  const providers = {
    groq: { keys: () => getKeys('GROQ_API_KEYS'), call: groqCall },
    gemini: { keys: () => getKeys('GEMINI_API_KEYS'), call: geminiCall },
    openai: { keys: () => getKeys('OPENAI_API_KEYS'), call: openaiCall }
  };

  const errors: string[] = [];

  for (const providerName of providerOrder) {
    const provider = providers[providerName as keyof typeof providers];
    if (!provider) continue;

    const keys = provider.keys();
    if (keys.length === 0) {
      console.log(`[Rotating-AI] ${providerName}: no keys configured, skipping`);
      continue;
    }

    // Try up to 3 keys per provider
    for (let attempt = 0; attempt < Math.min(3, keys.length); attempt++) {
      const key = getBestKey(keys);
      if (!key) break;

      markKeyUsed(key);
      try {
        console.log(`[Rotating-AI] Trying ${providerName} (Attempt ${attempt + 1})`);
        const result = await provider.call(key, systemMessage, userMessage, options);
        
        console.log(`[Rotating-AI] ${providerName} returned ${result ? result.length : 0} chars`);
        
        if (result && result.length > 0) {
          console.log(`[Rotating-AI] SUCCESS from ${providerName}, first 200 chars: ${result.substring(0, 200)}`);
          return {
            success: true,
            content: result,
            provider: providerName,
            model: options.model
          };
        } else {
          console.warn(`[Rotating-AI] ${providerName} returned EMPTY result (no error thrown)`);
        }
      } catch (error: any) {
        const errMsg = error.message || String(error);
        console.error(`[Rotating-AI] ${providerName} Error (Attempt ${attempt + 1}):`, errMsg);
        errors.push(`${providerName}[${attempt + 1}]: ${errMsg}`);
        
        if (error.message?.includes('rate') || error.message?.includes('429') || error.status === 429) {
          markKeyFailed(key);
        }
        
        // Always continue to next attempt/key instead of breaking
        continue;
      }
    }
  }

  const errorDetail = errors.length > 0 
    ? `All AI providers failed. Errors: ${errors.join(' | ')}` 
    : 'All AI providers and keys failed. No keys configured for any provider.';
  
  console.error(`[Rotating-AI] ${errorDetail}`);

  return {
    success: false,
    error: errorDetail
  };
}
