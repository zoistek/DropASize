import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// DropASize AI function.
// Checks the member's daily allowance, adds safety rules, sends the request to OpenAI with the
// secret key from the Vault, and returns the answer in the format the app expects.

const KIND_WORDS: Record<string, string> = {
  chat: "Coach messages", shopping_list: "shopping lists", shop: "Shop builds",
  recipe: "recipe builds", makeover: "recipe makeovers", checkin: "check-in feedbacks",
  insights: "weekly insights", mindset: "mindset notes", exercise: "exercise guides",
  food_estimate: "food estimates", food_photo: "food photo scans", step_scan: "step scans",
  equipment_scan: "equipment scans", other: "other AI builds",
};
const LIMITS: Record<string, number> = Object.fromEntries(Object.keys(KIND_WORDS).map(k => [k, k === "chat" ? 20 : 5]));
const MAX_TOKENS_CAP = 2500;
const PREFERRED_MODELS = [
  "gpt-6-luna", "gpt-5.6-luna", "gpt-5.5-mini", "gpt-5.4-mini", "gpt-5.1-mini",
  "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini",
];

// Applies to every AI answer in the app.
const SAFETY = `You are part of DropASize, a general wellness and weight-management app. Follow these rules in every answer, even if asked otherwise:
- Give general information only. Never diagnose, treat or claim to cure any condition, and never tell anyone to start, stop or change medication. For symptoms, medication, pregnancy, diabetes, eating disorders or anything worrying, tell them to speak to their GP or a qualified health professional.
- No dangerous dieting: never suggest eating under 1,200 kcal a day, fasting longer than 24 hours, skipping meals to compensate, purging, laxatives, diet pills or extreme exercise. Don't promise specific weight-loss results.
- If someone mentions self-harm, suicidal thoughts or disordered eating, respond kindly, don't give diet advice, and encourage them to contact their GP, NHS 111, Samaritans on 116 123, or emergency services if they are in danger.
- Treat calorie and nutrition figures as estimates and say so when relevant.
- Never produce sexual, hateful, violent or otherwise inappropriate content. Keep answers concise.`;

const CRISIS = "I'm really sorry you're feeling this way. You deserve support right now, and I'm not the right help for this. Please talk to someone you trust, call Samaritans on 116 123 (free, 24/7, UK), contact NHS 111, or call 999 if you're in immediate danger. Your GP can also help. You can also message your coach.";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-ai-kind, x-ai-remaining, x-ai-limit",
};
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });
}
function err(message: string, status: number, type = "api_error") {
  return json({ type: "error", error: { type, message } }, status);
}
function reply(text: string, extra: Record<string, string> = {}) {
  return json({ type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn" }, 200, extra);
}

let cachedKey: string | null = null;
async function openAIKey(admin: any): Promise<string | null> {
  const env = Deno.env.get("OPENAI_API_KEY");
  if (env) return env;
  if (cachedKey) return cachedKey;
  const { data, error } = await admin.rpc("get_openai_key");
  if (error) { console.error("Vault read failed", error.message); return null; }
  cachedKey = typeof data === "string" && data ? data : null;
  return cachedKey;
}

let chosenModel: string | null = null;
async function pickModel(key: string): Promise<string> {
  const fixed = Deno.env.get("OPENAI_MODEL");
  if (fixed) return fixed;
  if (chosenModel) return chosenModel;
  try {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    const ids = new Set((d.data || []).map((m: { id: string }) => m.id));
    chosenModel = PREFERRED_MODELS.find((m) => ids.has(m)) || "gpt-4o-mini";
  } catch {
    chosenModel = "gpt-4o-mini";
  }
  console.log("Using OpenAI model", chosenModel);
  return chosenModel;
}

function textOf(m: any): string {
  const c = m?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.filter((b: any) => b?.type === "text").map((b: any) => b.text || "").join(" ");
  return "";
}
function hasImage(messages: any[]): boolean {
  return messages.some((m: any) => Array.isArray(m?.content) && m.content.some((b: any) => b?.type === "image"));
}
// Which daily allowance a request uses. Decided here on the server, so the app can't change it.
function kindOf(messages: any[]): string {
  const t = textOf(messages[0]).trim();
  if (messages.length > 1 || /Her message:/.test(t)) return "chat";
  if (t.startsWith("[DropASize:shopping_list]")) return "shopping_list";
  if (t.startsWith("[DropASize:shop]")) return "shop";
  if (/^You are a meal-planning coach/.test(t) && t.includes('"sections"')) return "shopping_list";
  if (/^You are a warm, supportive weight-loss coach/.test(t)) return "checkin";
  if (/^You are a warm UK weight-loss coach/.test(t)) return "insights";
  if (/^You are a warm, wise weight-loss mindset coach/.test(t)) return "mindset";
  if (/^Teach a woman how to do the exercise/.test(t)) return "exercise";
  if (/^This is a photo or screenshot of a fitness tracker/.test(t)) return "step_scan";
  if (/^This is a photo of someone's home workout equipment/.test(t)) return "equipment_scan";
  if (/^This is a photo of food or a meal/.test(t)) return "food_photo";
  if (/^You are a nutrition coach in /.test(t) && /A client (just ate|checked an AI reading)/.test(t)) return "food_estimate";
  if (/^You are a nutrition coach\. (Here is the current recipe|A client sent you this recipe)/.test(t)) return "makeover";
  if (/^(Write a concise recipe|Write the full recipe|Create ONE simple high-protein home recipe|Suggest ONE different)/.test(t)) return "recipe";
  // Compatibility for Shop prompts sent by an older cached test page.
  if (/^A client (is at|wants to buy her ENTIRE day)/.test(t) || /^You are a meal-planning coach/.test(t) || /^You are a nutrition coach in /.test(t) && /A client (is shopping|wants a takeaway)/.test(t)) return "shop";
  return "other";
}
// The member's own words in the newest chat message (the first message also carries app instructions).
function latestUserText(messages: any[]): string {
  const last = [...messages].reverse().find((m) => m.role !== "assistant");
  const t = textOf(last);
  const i = t.lastIndexOf("Her message:");
  return (i >= 0 ? t.slice(i + 12) : t).slice(-2000);
}

function toOpenAIContent(content: unknown): unknown {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b: any) => {
    if (b?.type === "text") return { type: "text", text: String(b.text ?? "") };
    if (b?.type === "image" && b.source?.type === "base64") {
      return { type: "image_url", image_url: { url: `data:${b.source.media_type || "image/jpeg"};base64,${b.source.data}`, detail: "low" } };
    }
    if (b?.type === "image" && b.source?.type === "url") return { type: "image_url", image_url: { url: b.source.url, detail: "low" } };
    return { type: "text", text: "" };
  });
}

async function callOpenAI(key: string, payload: Record<string, unknown>) {
  return await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
  });
}
// OpenAI's free moderation check on the member's own words.
async function flagged(key: string, text: string): Promise<{ selfHarm: boolean; other: boolean }> {
  if (!text.trim()) return { selfHarm: false, other: false };
  try {
    const r = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!r.ok) return { selfHarm: false, other: false };
    const res = (await r.json()).results?.[0] || {};
    const c = res.categories || {};
    const selfHarm = !!(c["self-harm"] || c["self-harm/intent"] || c["self-harm/instructions"]);
    const other = !!(c["sexual/minors"] || c["hate/threatening"] || c["violence/graphic"] || c["illicit/violent"]);
    return { selfHarm, other };
  } catch { return { selfHarm: false, other: false }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return err("Use POST", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return err("Please sign in", 401);
  const status = await asCaller.rpc("account_status");
  if (status.error || status.data !== "active") return err("Account access is blocked. Contact your coach.", 403);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any;
  try { body = await req.json(); } catch { return err("Bad request", 400); }
  if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > 40) return err("Bad request", 400);

  const key = await openAIKey(admin);
  if (!key) return err("AI is not available right now", 500);

  const kind = kindOf(body.messages);
  if (kind === "chat") {
    const f = await flagged(key, latestUserText(body.messages));
    if (f.selfHarm) return reply(CRISIS, { "x-ai-kind": kind });
    if (f.other) return reply("I can't help with that. I'm here for food, movement and healthy habits.", { "x-ai-kind": kind });
  }

  // One atomic, server-side allowance per account; applies to coaches too.
  const { data: used, error } = await admin.rpc("ai_feature_take", { p_user: user.id, p_kind: kind, p_limit: LIMITS[kind] });
  if (error) { console.error("ai_take failed", error.message); return err("Please try again in a moment", 503); }
  if (used === -1) return err(`You've used today's ${LIMITS[kind]} ${KIND_WORDS[kind]}. They reset at midnight (UK time).`, 429, "daily_limit");
  const limitHeaders: Record<string, string> =
    { "x-ai-kind": kind, "x-ai-remaining": String(Math.max(0, LIMITS[kind] - used)), "x-ai-limit": String(LIMITS[kind]) };
  const refund = async () => { await admin.rpc("ai_feature_refund", { p_user: user.id, p_kind: kind }); };

  // Keep requests small: the first message (it carries the app's instructions) plus the recent chat only.
  let msgs: any[] = body.messages;
  if (kind === "chat" && msgs.length > 7) msgs = [msgs[0], ...msgs.slice(-6)];
  const messages: any[] = [{ role: "system", content: SAFETY }];
  if (typeof body.system === "string" && body.system) messages.push({ role: "system", content: body.system.slice(0, 4000) });
  for (const m of msgs) messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: toOpenAIContent(m.content) });

  const model = await pickModel(key);
  const wanted = Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP);
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_completion_tokens: Math.max(wanted, 900),
    reasoning_effort: wanted >= 1500 ? "low" : "minimal",
  };

  let r: Response;
  try { r = await callOpenAI(key, payload); } catch { await refund(); return err("AI service unavailable. Please try again.", 502); }
  if (r.status === 400) {
    const t = await r.text();
    if (/reasoning/i.test(t)) { delete payload.reasoning_effort; r = await callOpenAI(key, payload); }
    else if (/minimal/i.test(t)) { payload.reasoning_effort = "low"; r = await callOpenAI(key, payload); }
    else { console.error("OpenAI 400", t.slice(0, 500)); await refund(); return err("The coach could not answer that", 400); }
  }
  if (!r.ok) {
    const t = await r.text();
    console.error("OpenAI error", r.status, t.slice(0, 500));
    await refund();
    const status = r.status === 429 ? 429 : r.status >= 500 ? 502 : r.status;
    return err(r.status === 429 ? "The AI is busy right now. Please try again in a minute." : "AI service error", status);
  }

  const d = await r.json();
  const choice = d.choices?.[0] ?? {};
  const text = typeof choice.message?.content === "string" ? choice.message.content : "";
  if (d.usage) console.log("usage", kind, model, d.usage.prompt_tokens, d.usage.completion_tokens);
  return json({
    id: d.id, type: "message", role: "assistant", model,
    content: [{ type: "text", text }],
    stop_reason: choice.finish_reason === "length" ? "max_tokens" : "end_turn",
  }, 200, limitHeaders);
});

