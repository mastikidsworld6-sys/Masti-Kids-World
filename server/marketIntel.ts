import type { EconomicEvent, NewsItem } from '../src/types/trading.ts';

interface FeedSource {
  name: string;
  url: string;
  category: NewsItem['category'];
}

const RSS_FEEDS: FeedSource[] = [
  {
    name: 'FXStreet News',
    url: 'https://www.fxstreet.com/rss/news',
    category: 'Forex',
  },
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    category: 'Crypto',
  },
  {
    name: 'CNBC Markets',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069',
    category: 'Stocks',
  },
  {
    name: 'CNBC Economy',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258',
    category: 'Macro',
  },
  {
    name: 'Kitco Gold & Metals',
    url: 'https://www.kitco.com/rss/category/commodities',
    category: 'Commodities',
  },
];

let cachedNews: NewsItem[] = [];
let lastNewsFetch = 0;
let newsErrors: string[] = [];

let cachedCalendar: EconomicEvent[] = [];
let lastCalendarFetch = 0;
let calendarError: string | null = null;

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectRelevantSymbols(text: string, category: NewsItem['category']): string[] {
  const upper = text.toUpperCase();
  const matches: string[] = [];
  const pairs: [RegExp, string][] = [
    [/\bEUR\/USD\b|\bEURO\b|\bECB\b/, 'EURUSD'],
    [/\bGBP\/USD\b|\bSTERLING\b|\bBOE\b/, 'GBPUSD'],
    [/\bUSD\/JPY\b|\bYEN\b|\bBOJ\b/, 'USDJPY'],
    [/\bFED\b|\bFOMC\b|\bDOLLAR\b|\bDXY\b/, 'DXY'],
    [/\bGOLD\b|\bXAU\b/, 'XAUUSD'],
    [/\bSILVER\b|\bXAG\b/, 'XAGUSD'],
    [/\bOIL\b|\bWTI\b|\bBRENT\b|\bOPEC\b/, 'USOIL'],
    [/\bBITCOIN\b|\bBTC\b/, 'BTCUSDT'],
    [/\bETHEREUM\b|\bETH\b/, 'ETHUSDT'],
    [/\bSOLANA\b|\bSOL\b/, 'SOLUSDT'],
    [/\bS&P 500\b|\bSPX\b|\bNASDAQ\b/, 'US500'],
  ];
  for (const [regex, sym] of pairs) {
    if (regex.test(upper)) matches.push(sym);
  }
  if (matches.length === 0) {
    if (category === 'Crypto') matches.push('BTCUSDT');
    else if (category === 'Commodities') matches.push('XAUUSD');
    else if (category === 'Forex') matches.push('EURUSD');
    else matches.push('US500');
  }
  return Array.from(new Set(matches)).slice(0, 4);
}

function parseRssXml(xml: string, source: FeedSource): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (let i = 0; i < Math.min(itemMatches.length, 10); i++) {
    const block = itemMatches[i];
    const titleRaw = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const linkRaw = block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1] || '';
    const descRaw = block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i)?.[1] || '';
    const pubRaw = block.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] || '';

    const title = decodeXmlEntities(titleRaw);
    const url = decodeXmlEntities(linkRaw);
    const summary = decodeXmlEntities(descRaw).slice(0, 240);
    if (!title || !url) continue;

    let category = source.category;
    if (/central bank|fed\b|ecb\b|boj\b|boe\b|rate decision|powell|lagarde/i.test(title)) {
      category = 'Central Banks';
    }

    const parsedDate = pubRaw ? new Date(decodeXmlEntities(pubRaw)) : new Date();
    const publishedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    items.push({
      id: `${source.name}-${Buffer.from(url).toString('base64').slice(0, 14)}`,
      title,
      summary: summary || title,
      source: source.name,
      url,
      publishedAt,
      category,
      symbols: detectRelevantSymbols(`${title} ${summary}`, category),
    });
  }
  return items;
}

export async function getMarketNews(forceRefresh = false): Promise<{
  items: NewsItem[];
  errors: string[];
  lastUpdated: string;
}> {
  const now = Date.now();
  if (!forceRefresh && cachedNews.length > 0 && now - lastNewsFetch < 120000) {
    return {
      items: cachedNews,
      errors: newsErrors,
      lastUpdated: new Date(lastNewsFetch).toISOString(),
    };
  }

  const nextItems: NewsItem[] = [];
  const errors: string[] = [];

  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const resp = await fetch(feed.url, {
          headers: { 'User-Agent': 'CHARANJEET-QUANTX/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const xml = await resp.text();
        nextItems.push(...parseRssXml(xml, feed));
      } catch (err) {
        errors.push(`${feed.name}: ${err instanceof Error ? err.message : 'Feed unavailable'}`);
      }
    })
  );

  nextItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (nextItems.length > 0) {
    cachedNews = nextItems;
  }
  lastNewsFetch = now;
  newsErrors = errors;

  return {
    items: cachedNews,
    errors: newsErrors,
    lastUpdated: new Date(lastNewsFetch).toISOString(),
  };
}

export async function getEconomicCalendar(forceRefresh = false): Promise<{
  events: EconomicEvent[];
  error: string | null;
  lastUpdated: string;
}> {
  const now = Date.now();
  if (!forceRefresh && cachedCalendar.length > 0 && now - lastCalendarFetch < 300000) {
    return {
      events: cachedCalendar,
      error: calendarError,
      lastUpdated: new Date(lastCalendarFetch).toISOString(),
    };
  }

  const candidateUrls = [
    'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
    'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json',
  ];

  let loaded = false;
  let lastErr: string | null = null;

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'CHARANJEET-QUANTX/1.0' },
        signal: AbortSignal.timeout(7000),
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const raw = (await resp.json()) as Array<{
        title?: string;
        country?: string;
        date?: string;
        impact?: string;
        forecast?: string;
        previous?: string;
        actual?: string;
      }>;

      const parsed: EconomicEvent[] = raw
        .filter((e) => e.title && e.date)
        .map((e, idx) => {
          const impRaw = (e.impact || 'Low').toUpperCase();
          const impact: EconomicEvent['impact'] =
            impRaw.includes('HIGH') ? 'HIGH' : impRaw.includes('MEDIUM') ? 'MEDIUM' : 'LOW';
          const country = (e.country || 'USD').toUpperCase();
          return {
            id: `cal-${idx}-${country}`,
            title: e.title || 'Macro Release',
            country,
            currency: country.slice(0, 3),
            impact,
            timeUtc: new Date(e.date || Date.now()).toISOString(),
            forecast: e.forecast || '—',
            previous: e.previous || '—',
            actual: e.actual || 'Pending',
            source: 'ForexFactory / FairEconomy Calendar Feed',
          };
        })
        .sort((a, b) => new Date(a.timeUtc).getTime() - new Date(b.timeUtc).getTime());

      cachedCalendar = parsed;
      calendarError = null;
      lastCalendarFetch = now;
      loaded = true;
      break;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : 'Calendar feed unreachable';
    }
  }

  if (!loaded) {
    calendarError = `Economic calendar feed unavailable (${lastErr || 'upstream error'}).`;
    lastCalendarFetch = now;
  }

  return {
    events: cachedCalendar,
    error: calendarError,
    lastUpdated: new Date(lastCalendarFetch).toISOString(),
  };
}
