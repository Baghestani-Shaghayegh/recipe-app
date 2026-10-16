// Supabase Edge Function: turns recipe text in any language (an Instagram caption, a photo of a
// cookbook page, a PDF) into an English recipe the app can save.
//
// The Anthropic API key stays here, on the server, as the ANTHROPIC_API_KEY secret. The app only
// sends the text and gets back JSON.
//
// Deploy: supabase functions deploy parse-recipe --no-verify-jwt
// Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.135.0';

const MODEL = 'claude-opus-5-5';
// Long enough for any real recipe; stops anyone sending whole books through the key.
const MAX_INPUT_CHARS = 12_000;
// Per-instance throttle so one caller can't run up the bill.
const MAX_REQUESTS_PER_MINUTE = 20;

const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Baking', 'Unknown'] as const;

// The exact shape Claude must answer in (structured outputs).
const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'isRecipe',
    'language',
    'title',
    'servings',
    'prepMinutes',
    'cookMinutes',
    'category',
    'ingredients',
    'steps',
    'notes',
  ],
  properties: {
    isRecipe: { type: 'boolean' },
    language: { type: 'string' },
    title: { type: 'string' },
    servings: { type: 'integer' },
    prepMinutes: { type: 'integer' },
    cookMinutes: { type: 'integer' },
    category: { type: 'string', enum: [...CATEGORIES] },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};

const SYSTEM = `You turn recipe text into a clean English recipe for a home-cooking app.
The text may be an Instagram, TikTok or YouTube caption, text read from a photo, or a document.
It may be in any language (often Persian/Farsi) and may mix in emojis, hashtags and chatter.

Fill in the fields like this:
- isRecipe: false if the text has no recipe in it at all (then leave the other fields empty or 0).
- language: the language the text was written in, in English (e.g. "Persian").
- title: a short English name for the dish. Keep well-known dish names recognisable, e.g. "Ghormeh Sabzi (Persian herb stew)".
- ingredients: one ingredient per item, in English, written as "amount unit name, preparation", e.g. "2 tbsp butter", "1 onion, finely chopped", "200 g basmati rice". Turn Persian or Arabic digits into 0-9. Keep the amounts and units the text gives; use common English units (g, kg, ml, l, cup, tbsp, tsp). Translate Persian kitchen measures: "قاشق غذاخوری" = tbsp, "قاشق چای‌خوری" = tsp, "پیمانه" = cup, "لیوان" = cup. If there is no amount, write just the ingredient ("salt", "oil for frying"). Only list ingredients the text actually mentions.
- steps: the method in order, one step per item, in clear English, without step numbers. If the text only describes the method in a paragraph, split it into sensible steps.
- servings, prepMinutes, cookMinutes: whole numbers if the text says or clearly implies them, otherwise 0.
- category: the best fit of Breakfast, Lunch, Dinner, Snack or Baking (cakes, bread, cookies, pastries); Unknown if none fits.
- notes: useful tips from the text, in English, as a short paragraph. Leave out hashtags, follow/like/share requests, ads and greetings. Empty string if there are none.

Translate faithfully. Do not invent quantities, ingredients or steps that are not in the text.`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const recent = new Map<string, number[]>();
function tooMany(caller: string): boolean {
  const now = Date.now();
  const times = (recent.get(caller) ?? []).filter((t) => now - t < 60_000);
  times.push(now);
  recent.set(caller, times);
  return times.length > MAX_REQUESTS_PER_MINUTE;
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const caller = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (tooMany(caller)) return json({ error: 'Too many requests. Try again in a minute.' }, 429);

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return json({ error: 'Send JSON: { "text": "..." }' }, 400);
  }
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'No text.' }, 400);
  if (text.length > MAX_INPUT_CHARS) return json({ error: 'That text is too long.' }, 413);

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // A safety decline is retried on Anthropic's recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Translating and sorting one recipe doesn't need deep thinking.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: RECIPE_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `<recipe_text>\n${text}\n</recipe_text>` }],
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'The recipe reader declined this text.' }, 422);
    }
    if (response.stop_reason === 'max_tokens') {
      return json({ error: 'That recipe was too long to finish reading.' }, 422);
    }
    const out = response.content.find((b) => b.type === 'text');
    if (!out || out.type !== 'text')
      return json({ error: 'No answer from the recipe reader.' }, 502);
    return json({ recipe: JSON.parse(out.text) });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: 'The recipe reader is busy. Try again in a minute.' }, 429);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY is missing or wrong');
      return json({ error: 'The recipe reader isn’t set up yet.' }, 503);
    }
    if (e instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${e.status}: ${e.message}`);
      return json({ error: 'The recipe reader had a problem. Try again.' }, 502);
    }
    console.error(e);
    return json({ error: 'The recipe reader had a problem. Try again.' }, 500);
  }
});
