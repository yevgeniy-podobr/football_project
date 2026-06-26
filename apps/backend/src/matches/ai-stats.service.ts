import { GoogleGenAI } from '@google/genai';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GoalEvent {
  scorer: string;
  minute: number;
}

export interface CardEvent {
  player: string;
  minute: number;
  type: 'yellow' | 'red';
}

export interface AiMatchStats {
  goals: { home: GoalEvent[]; away: GoalEvent[] };
  cards: { home: CardEvent[]; away: CardEvent[] };
  possession: { home: number; away: number };
  shots: {
    home: { onTarget: number; total: number };
    away: { onTarget: number; total: number };
  };
}

export interface KeyPlayer {
  name: string;
  note: string;
}

export interface AiMatchPreview {
  form: { home: string; away: string };
  keyPlayers: { home: KeyPlayer[]; away: KeyPlayer[] };
  headToHead: string | null;
  summary: string;
}

export type Lang = 'en' | 'uk';

// Per-language stats store — the shape persisted in Match.aiStats going forward.
// Legacy records (flat AiMatchStats shape with a top-level "goals" key) are treated as English.
export interface AiStatsStore {
  en?: AiMatchStats;
  uk?: AiMatchStats;
}

// Per-language preview store — the shape persisted in Match.aiPreview going forward.
// Legacy records (flat AiMatchPreview shape with a top-level "form" key) are treated as English.
export interface AiPreviewStore {
  en?: AiMatchPreview;
  uk?: AiMatchPreview;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function isLegacyStats(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'goals' in (obj as object) &&
    !('en' in (obj as object)) &&
    !('uk' in (obj as object))
  );
}

function normalizeStatsStore(raw: unknown): AiStatsStore {
  if (raw === null || raw === undefined) return {};
  if (isLegacyStats(raw)) return { en: raw as AiMatchStats };
  return raw as AiStatsStore;
}

function isLegacyPreview(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'form' in (obj as object) &&
    !('en' in (obj as object)) &&
    !('uk' in (obj as object))
  );
}

function normalizePreviewStore(raw: unknown): AiPreviewStore {
  if (raw === null || raw === undefined) return {};
  if (isLegacyPreview(raw)) return { en: raw as AiMatchPreview };
  return raw as AiPreviewStore;
}

async function fetchPreviewFromSearch(
  homeTeamName: string,
  awayTeamName: string,
  competition: string,
  season: string,
  matchDate: Date,
  lang: Lang,
  ai: GoogleGenAI,
): Promise<AiMatchPreview> {
  const dateStr = matchDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const langInstruction =
    lang === 'uk'
      ? 'Write the keyPlayer notes, headToHead, and summary fields in Ukrainian. Player and team names must stay in their original form (do not translate names).'
      : 'Write all text fields in English.';

  const prompt = `You are a football analyst. Provide a pre-match preview for this upcoming match:

${homeTeamName} (home) vs ${awayTeamName} (away)
Competition: ${competition}
Season: ${season}
Scheduled: ${dateStr}

Use Google Search to find current information. Return ONLY a valid JSON object — no markdown, no explanation — with this exact structure:
{
  "form": {
    "home": "WWDLW",
    "away": "LDWWL"
  },
  "keyPlayers": {
    "home": [
      { "name": "Player Name", "note": "Brief reason they are key (e.g. top scorer, captain)" }
    ],
    "away": [
      { "name": "Player Name", "note": "Brief reason they are key" }
    ]
  },
  "headToHead": "One sentence about recent H2H record if notable, or null if not significant",
  "summary": "2-3 sentence match preview and prediction."
}

Rules:
- "form" strings must be exactly 5 characters, each W, D, or L (most recent last). Use best available data.
- "keyPlayers": 1-2 players per team only.
- "headToHead": string or null.
- "summary": concise, factual, 2-3 sentences max.
- ${langInstruction}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  return parsePreviewFromText(response.text ?? '');
}

async function translatePreview(
  source: AiMatchPreview,
  targetLang: Lang,
  ai: GoogleGenAI,
): Promise<AiMatchPreview> {
  const langName = targetLang === 'uk' ? 'Ukrainian' : 'English';
  const prompt = `Translate this football match preview to ${langName}.

Rules:
- Keep the exact same JSON structure.
- Translate ONLY these text fields: keyPlayers[].note, headToHead (if not null), summary.
- Do NOT translate: form strings (W/D/L sequences), player names, team names.
- Return ONLY valid JSON — no markdown, no explanation.

${JSON.stringify(source, null, 2)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    // No googleSearch — pure translation, no grounding needed
  });

  return parsePreviewFromText(response.text ?? '');
}

function parsePreviewFromText(text: string): AiMatchPreview {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response');
  return JSON.parse(raw.slice(start, end + 1)) as AiMatchPreview;
}

function parseJsonFromText(text: string): AiMatchStats {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response');
  return JSON.parse(raw.slice(start, end + 1)) as AiMatchStats;
}

// ─── service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AiStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrFetchStats(matchId: number, lang: Lang = 'en'): Promise<AiMatchStats> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Match #${matchId} not found`);

    const store = normalizeStatsStore(match.aiStats);

    // Return cached data for this language immediately
    const cachedLang = store[lang];
    if (cachedLang) return cachedLang;

    const otherLang: Lang = lang === 'en' ? 'uk' : 'en';
    const otherLangData = store[otherLang];

    let stats: AiMatchStats;

    if (otherLangData) {
      // Stats data is language-agnostic (numbers + player names) — copy directly, no Gemini call needed
      stats = otherLangData;
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

      const matchDate = new Date(match.matchDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const prompt = `Find the detailed statistics for this football match:

${match.homeTeam.name} (home) vs ${match.awayTeam.name} (away)
Competition: ${match.competition}
Season: ${match.season}
Date: ${matchDate}

Return ONLY a valid JSON object — no markdown, no explanation — with this exact structure:
{
  "goals": {
    "home": [{ "scorer": "Player Name", "minute": 45 }],
    "away": [{ "scorer": "Player Name", "minute": 78 }]
  },
  "cards": {
    "home": [{ "player": "Player Name", "minute": 34, "type": "yellow" }],
    "away": [{ "player": "Player Name", "minute": 67, "type": "red" }]
  },
  "possession": { "home": 55, "away": 45 },
  "shots": {
    "home": { "onTarget": 4, "total": 12 },
    "away": { "onTarget": 2, "total": 8 }
  }
}

Use the Google Search tool to find accurate data. If data for a field is unavailable, use an empty array or 0.`;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      stats = parseJsonFromText(response.text ?? '');
    }

    const updatedStore: AiStatsStore = { ...store, [lang]: stats };
    await this.prisma.match.update({
      where: { id: matchId },
      data: { aiStats: updatedStore as unknown as Prisma.InputJsonValue },
    });

    return stats;
  }

  async getOrFetchPreview(matchId: number, lang: Lang = 'en'): Promise<AiMatchPreview> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Match #${matchId} not found`);

    if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') {
      throw new BadRequestException('AI Preview is only available for scheduled matches');
    }

    const store = normalizePreviewStore(match.aiPreview);

    // Return cached data for this language immediately
    const cachedLang = store[lang];
    if (cachedLang) return cachedLang;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const ai = new GoogleGenAI({ apiKey });
    const otherLang: Lang = lang === 'en' ? 'uk' : 'en';
    const otherLangData = store[otherLang];

    let preview: AiMatchPreview;

    if (otherLangData) {
      // Translate from the other language (cheaper — no Google Search grounding needed)
      preview = await translatePreview(otherLangData, lang, ai);
    } else {
      // Nothing cached — fetch fresh with Google Search grounding in the requested language
      preview = await fetchPreviewFromSearch(
        match.homeTeam.name,
        match.awayTeam.name,
        match.competition,
        match.season,
        new Date(match.matchDate),
        lang,
        ai,
      );
    }

    // Merge the new language into the existing store and persist
    const updatedStore: AiPreviewStore = { ...store, [lang]: preview };
    await this.prisma.match.update({
      where: { id: matchId },
      data: { aiPreview: updatedStore as unknown as Prisma.InputJsonValue },
    });

    return preview;
  }
}
