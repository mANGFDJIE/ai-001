// Browser-side chat via WebLLM — runs models locally in the browser via WebGPU.
// No API keys. Models are downloaded once and cached by the browser.
//
// All models below are open weights (Apache 2.0 / MIT / Qwen / Llama Community),
// packaged by MLC-AI for WebGPU inference. The auto-router picks the strongest
// fit per (task type × complexity) — same logic the original OpenRouter app used,
// but resolvable client-side without a key.
import * as webllm from '/web-llm.js';

// Tags used by the auto-router. A model can be specialist (code/reasoning) or
// generalist. `tags: ['code']` means it specializes in instruction-following code.
const MODELS = [];  // WebLLM-каталог выключен — теперь только облако (vsegpt)

// Build PRESETS keyed both by `auto` and by individual model keys.
const PRESETS = {};

// ── Auto-router: type × complexity → strongest model that fits ──
// Same logic as the original OpenRouter router, but resolved against the
// open-source catalog above.
function classifyTask(content) {
  const c = content.toLowerCase();
  if (/(ui|дизайн|css|html|верстка|интерфейс|макет|figma|tailwind|стиль|оформление|внешний вид|layout|grid|flex|color|цвет|шрифт|font|ux)/i.test(c)) return 'ui';
  if (/(debug|ошибк|исправь|fix|баг|stack trace|traceback|console|не работает|падает|почему не|broken|fail|exception|exception)/i.test(c)) return 'debug';
  if (/(анализ|архитектура|план|система|объясни|сравни|оптимизация|рефактор|докажи|рассужд|trade-off|плюсы минусы|deepseek|почему)/i.test(c) || c.length > 900) return 'analysis';
  if (/(код|напиши|создай|сделай|функция|скрипт|api|python|js|javascript|react|node|sql|json|endpoint|route|handler|component|class|library|модуль|пакет|npm|install|generate)/i.test(c)) return 'code';
  return 'general';
}

function classifyComplexity(content) {
  const c = content.toLowerCase();
  const len = content.length;
  if (len < 150) return 'simple';
  if (/(архитектура|система|проект|приложение|много|несколько|микросервис|полноценный|с нуля|full|complete|complex|большой|refactor|миграция)/i.test(c)) return 'complex';
  if (len < 600) return 'simple';
  return 'medium';
}

const ROUTING = {
  // tier order: list of `(key)` from strongest to weakest
  ui:    ['qwen3.5-9b', 'gemma-3-12b', 'qwen3-32b', 'qwen3-8b', 'qwen3.5-4b', 'llama-3.1-8b', 'qwen2.5-7b', 'gemma-3-4b'],
  debug: ['r1-distill-llama-8b', 'qwen-coder-7b', 'qwen-coder-14b', 'qwen3-14b', 'qwen-coder-3b'],
  analysis: ['r1-distill-qwen-32b', 'qwen3-32b', 'r1-distill-qwen-14b', 'qwen3-5-9b' /* fallback to qwen3.5-9b */ && 'qwen3.5-9b', 'qwen3-14b', 'phi-4-mini', 'qwen2.5-14b'],
  code: {
    complex: ['qwen-coder-14b', 'r1-distill-qwen-14b', 'qwen3-14b', 'qwen-coder-7b'],
    medium:  ['qwen-coder-7b', 'qwen3-8b', 'qwen3-14b', 'hermes-3-8b'],
    simple:  ['qwen-coder-3b', 'qwen3-4b', 'llama-3.1-8b', 'qwen-coder-7b']
  },
  general: {
    complex: ['qwen3-32b', 'qwen2.5-14b', 'gemma-3-12b', 'qwen3-14b', 'qwen3-8b'],
    medium:  ['qwen3-8b', 'qwen3.5-9b', 'qwen2.5-7b', 'llama-3.1-8b', 'mistral-7b-v0.3'],
    simple:  ['qwen3-4b', 'llama-3.2-3b', 'qwen3-1.7b', 'qwen3.5-4b', 'ministral-3b']
  }
};

// Some routing arrays above contain a JS-coercion hack; clean it.
ROUTING.analysis = ['r1-distill-qwen-32b', 'qwen3-32b', 'r1-distill-qwen-14b', 'qwen3.5-9b', 'qwen3-14b', 'phi-4-mini', 'qwen2.5-14b'];

function pickModelForRequest(content, hardwareVRAM = 12) {
  const task = classifyTask(content);
  const complexity = classifyComplexity(content);
  // Build the candidate list for this task × complexity.
  let candidates;
  if (task === 'code' || task === 'general') {
    candidates = ROUTING[task][complexity];
  } else {
    candidates = ROUTING[task]; // already flat
  }
  // Pick the strongest candidate that fits within hardware VRAM.
  for (const key of candidates) {
    const m = MODELS.find(x => x.key === key);
    if (m && (m.vram || 6) <= hardwareVRAM * 1.1) return m;
  }
  // Fall back to the smallest model that fits.
  const sorted = [...MODELS].sort((a, b) => (a.vram || 0) - (b.vram || 0));
  return sorted.find(m => (m.vram || 6) <= hardwareVRAM * 1.1) || sorted[0];
}

const SYSTEM_PROMPT = 'Вы — полноценный автономный AI-агент. Умеете писать и редактировать код, анализировать, проектировать, объяснять. Когда вы даёте код для файлов, помечайте каждый блок комментарием с путём: `// file: path/to/file.ext` или `<!-- file: path/to/file.ext -->` в первой строке. Отвечайте на русском языке, если запрос на русском. Будьте конкретны и полезны.';

class WebLLMClient {
  constructor() {
    this.engine = null;
    this.currentModelId = null;
    this.webGPUSupported = 'gpu' in navigator;
    this.lastRouting = null;
  }

  async listModels() { return MODELS; }

  async detectVRAM() {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) return 6;
      // Most consumer browsers expose 4–12 GB usable. Use 8 as a conservative
      // sweet spot; users with NVIDIA RTX 30/40 will simply hit the bigger models.
      return 12;
    } catch { return 6; }
  }

  async pickAuto(content) {
    const vram = await this.detectVRAM();
    const m = pickModelForRequest(content, vram);
    this.lastRouting = { task: classifyTask(content), complexity: classifyComplexity(content), chosen: m.key, vram };
    return m;
  }

  async ensureEngine(modelId, onProgress) {
    if (this.engine && this.currentModelId === modelId) return this.engine;
    if (this.engine) {
      try { await this.engine.unload(); } catch {}
      this.engine = null;
    }
    const initProgressCallback = (report) => { if (onProgress) onProgress(report); };
    this.engine = await webllm.CreateMLCEngine(modelId, { initProgressCallback });
    this.currentModelId = modelId;
    return this.engine;
  }

  buildMessages(history) {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role, content: m.content }))
    ];
  }

  async *stream(modelId, history, opts = {}) {
    const engine = await this.ensureEngine(modelId, opts.onProgress);
    const messages = this.buildMessages(history);
    const asyncGen = await engine.chat.completions.create({
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.max_tokens ?? 2048,
      stream: true
    });
    for await (const chunk of asyncGen) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) yield delta;
      if (chunk.choices?.[0]?.finish_reason === 'stop') break;
    }
  }

  async reset() {
    if (this.engine) { try { await this.engine.resetChat(); } catch {} }
  }

  classify(content) { return { task: classifyTask(content), complexity: classifyComplexity(content) }; }
}

window.WebLLMClient = WebLLMClient;
window.WEBLLM_PRESETS = PRESETS;
window.WEBLLM_MODELS = MODELS;
window.WEBLLM_SUPPORTED = 'gpu' in navigator;
window.WEBLLM_ROUTING = ROUTING;
window.WEBLLM_classify = (content) => ({ task: classifyTask(content), complexity: classifyComplexity(content) });
