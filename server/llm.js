// Server-side LLM inference via @huggingface/transformers (ONNX, CPU)
// Fully local, no API keys, no GPU needed.
// Downloads model once on first use, cached in ~/.cache/huggingface/

const path = require('path');

let pipeline = null;
let generator = null;
let modelLoaded = false;
let loading = false;
let loadError = null;

const MODEL_ID = process.env.LLM_MODEL || 'onnx-community/Qwen2.5-0.5B-Instruct';
const SYSTEM_PROMPT = 'Вы — полезный AI-ассистент. Отвечайте на русском языке. Будьте конкретны.';

async function ensureModel() {
  if (modelLoaded) return true;
  if (loadError) throw loadError;
  if (loading) {
    // Wait for current load to finish
    while (loading) await new Promise(r => setTimeout(r, 500));
    if (loadError) throw loadError;
    return modelLoaded;
  }

  loading = true;
  try {
    const tf = require('@huggingface/transformers');
    pipeline = tf.pipeline;
    console.log(`[llm] Loading model: ${MODEL_ID}...`);
    generator = await pipeline('text-generation', MODEL_ID, {
      max_new_tokens: 512,
      temperature: 0.7,
      do_sample: true,
      quantized: true,
    });
    modelLoaded = true;
    console.log(`[llm] Model ${MODEL_ID} loaded successfully`);
  } catch (err) {
    loadError = err;
    console.error(`[llm] Failed to load model:`, err.message);
    throw err;
  } finally {
    loading = false;
  }
  return modelLoaded;
}

async function generate(messages, opts = {}) {
  await ensureModel();

  // Apply chat template via the model's tokenizer
  const allMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.filter(m => m.role !== 'system')
  ];

  // Build prompt using Qwen2.5 chat template format
  let prompt = '<|im_start|>system\n' + SYSTEM_PROMPT + '<|im_end|>\n';
  for (const m of allMessages) {
    if (m.role === 'system') continue;
    prompt += `<|im_start|>${m.role}\n${m.content}<|im_end|>\n`;
  }
  prompt += '<|im_start|>assistant\n';

  const result = await generator(prompt, {
    max_new_tokens: opts.max_tokens || 1024,
    temperature: opts.temperature ?? 0.7,
    do_sample: true,
    repetition_penalty: 1.1,
  });

  const fullText = Array.isArray(result) ? result[0]?.generated_text || '' : result?.generated_text || '';
  // Extract just the new assistant response (after our prompt)
  const parts = fullText.split('<|im_start|>assistant\n');
  const reply = parts[parts.length - 1].split('<|im_end|>')[0].trim();
  return reply;
}

function status() {
  return {
    model: MODEL_ID,
    loaded: modelLoaded,
    loading,
    error: loadError?.message || null
  };
}

module.exports = { generate, ensureModel, status, MODEL_ID };
