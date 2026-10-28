'use strict';

const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  AI Task Description Assistant (Google Gemini + OpenAI fallback)
//
//  Responsible-AI notes:
//  • API keys live ONLY here on the backend (.env → process.env). They are
//    never sent to the browser and no VITE_ var is used.
//  • The AI call is optional: if it fails or times out, this route returns a
//    friendly error and the core task CRUD app keeps working normally.
//  • The suggestion is advisory — the UI shows a disclaimer banner and lets
//    the user edit or discard the text before saving.
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS, 10) || 15000;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// Keep the AI output tidy and bounded
const MAX_OUTPUT_CHARS = 700;

// Strip markdown fences / wrapping quotes the model occasionally adds
const sanitizeText = (text) => {
    if (!text) return '';
    let t = String(text).trim();
    t = t.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/, '');
    t = t.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '');
    t = t.replace(/\s+/g, ' ').trim();
    if (t.length > MAX_OUTPUT_CHARS) t = t.slice(0, MAX_OUTPUT_CHARS).trimEnd();
    return t;
};

// Shared prompt: ask for a short, safe, JSON-wrapped description
const buildPrompt = (cleanTitle) =>
    `You are a task-management assistant inside a to-do application. ` +
    `Given only the task title below, write one clear, concise, professional task ` +
    `description of 2-4 sentences (roughly 30-70 words). Describe what needs to be ` +
    `done and why it matters, in a neutral practical tone. Do NOT restate the title, ` +
    `do NOT use headings, bullet points or markdown, and never invent dates, names or ` +
    `numbers that were not provided.\n\nTask title: "${cleanTitle}"`;

// Result shape: { ok: true, description } | { ok: false, status, message }
// status 0 = network failure, 'abort' = timeout

const generateWithGemini = async (prompt, signal) => {
    const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 220,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'object',
                    properties: { description: { type: 'string' } },
                    required: ['description'],
                },
            },
        }),
        signal,
    });

    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const msg = body?.error?.message || '';
        console.error(`[AI] Gemini responded ${resp.status}: ${msg}`);
        return { ok: false, status: resp.status, message: msg };
    }

    const json = await resp.json().catch(() => null);
    const rawText = (json?.candidates?.[0]?.content?.parts || [])
        .map((p) => (p && p.text) || '').join('');
    let description = '';
    if (rawText) {
        try { description = sanitizeText(JSON.parse(rawText).description); }
        catch { description = sanitizeText(rawText); } // model replied as plain text
    }
    if (!description) return { ok: false, status: 502, message: 'empty response from Gemini' };
    return { ok: true, description };
};

// Shared OpenAI-compatible chat call (used for Groq and OpenAI)
const chatCompletion = async ({ url, apiKey, model, prompt, signal, label }) => {
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            temperature: 0.4,
            max_tokens: 220,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content:
                        'You are a task-management assistant. Reply ONLY with JSON: ' +
                        '{"description":"..."} containing a 2-4 sentence (30-70 word) ' +
                        'professional task description based on the given task title. ' +
                        'No headings, bullet points, or markdown. Never invent dates, names or numbers.',
                },
                { role: 'user', content: prompt },
            ],
        }),
        signal,
    });

    if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const msg = body?.error?.message || '';
        console.error(`[AI] ${label} responded ${resp.status}: ${msg}`);
        return { ok: false, status: resp.status, message: msg };
    }

    const json = await resp.json().catch(() => null);
    const rawText = json?.choices?.[0]?.message?.content || '';
    let description = '';
    if (rawText) {
        try { description = sanitizeText(JSON.parse(rawText).description); }
        catch { description = sanitizeText(rawText); }
    }
    if (!description) return { ok: false, status: 502, message: `empty response from ${label}` };
    return { ok: true, description };
};

const generateWithGroq = (prompt, signal) =>
    chatCompletion({ url: GROQ_URL, apiKey: GROQ_API_KEY, model: GROQ_MODEL, prompt, signal, label: 'Groq' });

const generateWithOpenAI = (prompt, signal) =>
    chatCompletion({ url: OPENAI_URL, apiKey: OPENAI_API_KEY, model: OPENAI_MODEL, prompt, signal, label: 'OpenAI' });

// Wrap a provider call so network failures & timeouts become structured results
const attempt = async (fn, prompt, signal) => {
    try {
        return await fn(prompt, signal);
    } catch (err) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            return { ok: false, status: 'abort', message: 'timeout' };
        }
        console.error(`[AI] Network error: ${err.message}`);
        return { ok: false, status: 0, message: err.message };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /ai/suggest-description   (protected)
//  Body: { title: string }
//  → { success: true, data: { description, provider, model, generatedAt } }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/suggest-description', authMiddleware, async (req, res) => {
    try {
        // ── Validation ───────────────────────────────────────────────────────
        const { title } = req.body || {};
        if (!title || typeof title !== 'string' || title.trim().length < 3) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'A task title of at least 3 characters is required.',
            });
        }
        const cleanTitle = title.trim().slice(0, 200);

        // ── Graceful degradation when no provider key is configured ──────────
        const providers = [];
        if (GEMINI_API_KEY) providers.push({ name: 'gemini', model: GEMINI_MODEL, fn: generateWithGemini });
        if (GROQ_API_KEY) providers.push({ name: 'groq', model: GROQ_MODEL, fn: generateWithGroq });
        if (OPENAI_API_KEY) providers.push({ name: 'openai', model: OPENAI_MODEL, fn: generateWithOpenAI });

        if (providers.length === 0) {
            return res.status(503).json({
                error: 'AI Not Configured',
                message: 'AI suggestions are not configured on the server. You can still write the description manually.',
            });
        }

        const prompt = buildPrompt(cleanTitle);

        // One timeout budget for the whole AI operation (provider keys stay server-side)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

        let result = null;
        let provider = '';
        let model = '';

        try {
            // Try providers in order; on upstream failure move to the next one.
            for (let i = 0; i < providers.length; i++) {
                const p = providers[i];
                provider = p.name;
                model = p.model;
                result = await attempt(p.fn, prompt, controller.signal);
                if (result.ok) break;
                if (result.status === 'abort') break; // shared timeout budget is spent
                if (i < providers.length - 1) {
                    console.error(`[AI] ${p.name} failed — trying next provider`);
                }
            }
        } finally {
            clearTimeout(timer);
        }

        // ── Map failures to friendly, non-fatal responses ────────────────────
        if (!result.ok) {
            if (result.status === 'abort') {
                return res.status(504).json({
                    error: 'AI Timeout',
                    message: 'The AI service took too long to respond. Please try again.',
                });
            }
            if (result.status === 429) {
                return res.status(429).json({
                    error: 'AI Rate Limited',
                    message: 'The AI service is busy right now. Please try again in a moment.',
                });
            }
            if (result.status === 502 && /empty response/i.test(result.message || '')) {
                return res.status(502).json({
                    error: 'AI Empty Response',
                    message: 'The AI service returned an empty suggestion. Please try again.',
                });
            }
            if (result.status === 0) {
                return res.status(502).json({
                    error: 'AI Unavailable',
                    message: 'Could not reach the AI service. Please try again later.',
                });
            }
            return res.status(502).json({
                error: 'AI Upstream Error',
                message: 'The AI service returned an error. Please try again later.',
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                description: result.description,
                provider,
                model,
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('[AI] Unexpected error:', err.message);
        return res.status(500).json({
            error: 'AI Internal Error',
            message: 'Something went wrong while generating the suggestion. The rest of the app is unaffected.',
        });
    }
});

module.exports = router;
