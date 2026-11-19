import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `You are the CHARANJEET QUANTX Read-Only Market & Strategy Analyst.
Your role is strictly advisory and educational:
- Explain technical indicators, price structure, macro economic releases, liquidity context, and deterministic strategy parameters.
- Clearly distinguish verified broker/exchange data from analytical estimates.
- NEVER claim to execute, modify, or cancel trades, and NEVER instruct the terminal to submit orders automatically.
- Never promise profits or guaranteed trading outcomes.
- Keep responses concise, structured, quantitative, and institutional.`;

export async function analyzeMarketContext(params: {
  question: string;
  symbol: string;
  timeframe: string;
  bid?: number;
  ask?: number;
  spread?: number;
  provider?: string;
  recentCandlesSummary?: string;
  openPositionsSummary?: string;
  strategySummary?: string;
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }

  const prompt = [
    `Instrument: ${params.symbol} (${params.timeframe})`,
    `Data Source: ${params.provider || 'Unavailable'}`,
    params.bid !== undefined && params.ask !== undefined
      ? `Current Quote: Bid ${params.bid} / Ask ${params.ask} (Spread ${params.spread ?? 'N/A'} pts)`
      : 'Current Quote: Unavailable (No live broker feed)',
    params.recentCandlesSummary ? `Recent Price Action: ${params.recentCandlesSummary}` : '',
    params.openPositionsSummary ? `Account Exposure Context: ${params.openPositionsSummary}` : '',
    params.strategySummary ? `Strategy Context: ${params.strategySummary}` : '',
    `Analyst Question: ${params.question}`,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text || 'No analytical output generated.';
}
