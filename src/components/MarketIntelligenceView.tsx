import React, { useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { EconomicEvent, NewsItem } from '../types/trading.ts';

interface MarketIntelligenceViewProps {
  initialTab: 'NEWS' | 'CALENDAR';
}

export const MarketIntelligenceView: React.FC<MarketIntelligenceViewProps> = ({ initialTab }) => {
  const {
    news,
    newsErrors,
    calendarEvents,
    calendarError,
    refreshIntelligence,
    askAiAnalyst,
    selectedSymbol,
  } = useTrading();

  const [tab, setTab] = useState<'NEWS' | 'CALENDAR'>(initialTab);
  const [newsCategory, setNewsCategory] = useState<'ALL' | NewsItem['category']>('ALL');
  const [impactFilter, setImpactFilter] = useState<'ALL' | EconomicEvent['impact']>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const [macroPrompt, setMacroPrompt] = useState('');
  const [macroReply, setMacroReply] = useState<string | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshIntelligence(true);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredNews = useMemo(() => {
    return news.filter((item) => newsCategory === 'ALL' || item.category === newsCategory);
  }, [news, newsCategory]);

  const currencies = useMemo(() => {
    const set = new Set(calendarEvents.map((e) => e.currency).filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [calendarEvents]);

  const filteredCalendar = useMemo(() => {
    return calendarEvents.filter((ev) => {
      if (impactFilter !== 'ALL' && ev.impact !== impactFilter) return false;
      if (currencyFilter !== 'ALL' && ev.currency !== currencyFilter) return false;
      return true;
    });
  }, [calendarEvents, impactFilter, currencyFilter]);

  const handleMacroAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macroPrompt.trim()) return;
    setMacroLoading(true);
    try {
      const answer = await askAiAnalyst(macroPrompt.trim());
      setMacroReply(answer);
    } catch (err) {
      setMacroReply(err instanceof Error ? err.message : 'Unable to generate macro briefing.');
    } finally {
      setMacroLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#060911] p-5 gap-4 overflow-hidden">
      {/* Header & Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0B101B] border border-slate-800 rounded">
            <button
              type="button"
              onClick={() => setTab('NEWS')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                tab === 'NEWS' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              Market News ({news.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('CALENDAR')}
              className={`px-3 py-1.5 text-xs font-medium rounded cursor-pointer whitespace-nowrap ${
                tab === 'CALENDAR'
                  ? 'bg-cyan-500/20 text-cyan-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Economic Calendar ({calendarEvents.length})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0B101B] hover:bg-slate-800 text-slate-200 border border-slate-800 rounded cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Feeds
        </button>
      </div>

      {/* Read-Only Macro Analyst Briefing Bar */}
      <form
        onSubmit={handleMacroAsk}
        className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-3 space-y-2 shrink-0"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={macroPrompt}
            onChange={(e) => setMacroPrompt(e.target.value)}
            placeholder={`Ask Read-Only AI Analyst about ${selectedSymbol} macro drivers or upcoming releases...`}
            className="flex-1 bg-[#060911] border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={macroLoading}
            className="px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer whitespace-nowrap"
          >
            {macroLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {macroReply && (
          <div className="text-xs text-slate-300 bg-[#060911] border border-slate-800 rounded p-3 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
            {macroReply}
          </div>
        )}
      </form>

      {tab === 'NEWS' ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {(['ALL', 'Forex', 'Central Banks', 'Macro', 'Commodities', 'Stocks', 'Crypto'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewsCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] rounded border cursor-pointer whitespace-nowrap ${
                    newsCategory === cat
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#0B101B] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          {newsErrors.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Feed notice: {newsErrors.join(' · ')}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
            {filteredNews.length === 0 ? (
              <div className="col-span-full bg-[#0B101B] border border-slate-800 rounded-lg p-10 text-center text-xs text-slate-500">
                No financial news items available for this filter.
              </div>
            ) : (
              filteredNews.map((item) => (
                <article
                  key={item.id}
                  className="bg-[#0B101B] border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-cyan-400 font-medium">{item.source}</span>
                      <span className="font-mono-tabular text-slate-500">
                        {new Date(item.publishedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC
                      </span>
                    </div>
                    <h2 className="text-sm font-semibold text-white leading-snug">{item.title}</h2>
                    {item.summary && (
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                    <span className="text-slate-400">{item.category}</span>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                      >
                        Read Source <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => setImpactFilter(imp)}
                  className={`px-2.5 py-1 text-[11px] rounded border cursor-pointer ${
                    impactFilter === imp
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-[#0B101B] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {imp}
                </button>
              ))}
            </div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="px-2.5 py-1 bg-[#0B101B] border border-slate-800 rounded text-xs text-slate-200"
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  Currency: {c}
                </option>
              ))}
            </select>
          </div>

          {calendarError && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 text-[11px] text-amber-300 flex items-center gap-2 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{calendarError}</span>
            </div>
          )}

          <div className="flex-1 bg-[#0B101B] border border-slate-800/80 rounded-lg overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#080C15] border-b border-slate-800 text-[11px] text-slate-400">
                <tr>
                  <th className="text-left px-4 py-2.5">Time (UTC)</th>
                  <th className="text-left px-3 py-2.5">Currency</th>
                  <th className="text-left px-3 py-2.5">Impact</th>
                  <th className="text-left px-3 py-2.5">Event</th>
                  <th className="text-right px-3 py-2.5">Actual</th>
                  <th className="text-right px-3 py-2.5">Forecast</th>
                  <th className="text-right px-4 py-2.5">Previous</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono-tabular">
                {filteredCalendar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500 font-sans">
                      No economic calendar releases match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredCalendar.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                        {ev.timeUtc ? ev.timeUtc.slice(0, 16).replace('T', ' ') : 'Scheduled'}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white">{ev.currency}</td>
                      <td className="px-3 py-2.5 font-sans">
                        <span
                          className={`text-[10px] font-semibold ${
                            ev.impact === 'HIGH'
                              ? 'text-red-400'
                              : ev.impact === 'MEDIUM'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {ev.impact}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-100">{ev.title}</td>
                      <td className="px-3 py-2.5 text-right text-cyan-300">{ev.actual || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300">{ev.forecast || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{ev.previous || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
