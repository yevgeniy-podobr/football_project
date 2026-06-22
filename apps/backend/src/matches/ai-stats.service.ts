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

@Injectable()
export class AiStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrFetchStats(matchId: number): Promise<AiMatchStats> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Match #${matchId} not found`);

    if (match.aiStats !== null) {
      return match.aiStats as unknown as AiMatchStats;
    }

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
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text ?? '';
    const stats = parseJsonFromText(text);

    await this.prisma.match.update({
      where: { id: matchId },
      data: { aiStats: stats as unknown as Prisma.InputJsonValue },
    });

    return stats;
  }

  async getOrFetchPreview(matchId: number): Promise<AiMatchPreview> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Match #${matchId} not found`);

    if (match.status !== 'SCHEDULED' && match.status !== 'TIMED') {
      throw new BadRequestException('AI Preview is only available for scheduled matches');
    }

    if (match.aiPreview !== null) {
      return match.aiPreview as unknown as AiMatchPreview;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const matchDate = new Date(match.matchDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const prompt = `You are a football analyst. Provide a pre-match preview for this upcoming match:

${match.homeTeam.name} (home) vs ${match.awayTeam.name} (away)
Competition: ${match.competition}
Season: ${match.season}
Scheduled: ${matchDate}

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
- "summary": concise, factual, 2-3 sentences max.`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text ?? '';
    const preview = parsePreviewFromText(text);

    await this.prisma.match.update({
      where: { id: matchId },
      data: { aiPreview: preview as unknown as Prisma.InputJsonValue },
    });

    return preview;
  }
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
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;

  // Find outermost JSON object
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response');

  return JSON.parse(raw.slice(start, end + 1)) as AiMatchStats;
}
