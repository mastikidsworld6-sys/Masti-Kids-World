import React from 'react';
import {
  LayoutDashboard,
  CandlestickChart,
  Globe2,
  ListOrdered,
  DollarSign,
  Gem,
  Flame,
  TrendingUp,
  Building2,
  Coins,
  Bot,
  Sliders,
  Briefcase,
  Clock,
  History,
  PieChart,
  Newspaper,
  Calendar,
  PlugZap,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import type { NavSection } from '../types/trading.ts';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { id: 'terminal', label: 'Trading Terminal', icon: CandlestickChart, group: 'Workspace' },
  { id: 'globe', label: 'Global Liquidity Globe', icon: Globe2, group: 'Workspace' },
  { id: 'market-watch', label: 'Market Watch', icon: ListOrdered, group: 'Workspace' },

  { id: 'forex', label: 'Forex', icon: DollarSign, group: 'Asset Classes' },
  { id: 'metals', label: 'Metals', icon: Gem, group: 'Asset Classes' },
  { id: 'commodities', label: 'Commodities', icon: Flame, group: 'Asset Classes' },
  { id: 'indices', label: 'Global Indices', icon: TrendingUp, group: 'Asset Classes' },
  { id: 'stocks', label: 'Global Stocks', icon: Building2, group: 'Asset Classes' },
  { id: 'crypto', label: 'Crypto', icon: Coins, group: 'Asset Classes' },

  { id: 'auto-trading', label: 'Automated Trading', icon: Bot, group: 'Automation & Orders' },
  { id: 'strategy-builder', label: 'Strategy Builder', icon: Sliders, group: 'Automation & Orders' },
  { id: 'positions', label: 'Open Positions', icon: Briefcase, group: 'Automation & Orders' },
  { id: 'pending-orders', label: 'Pending Orders', icon: Clock, group: 'Automation & Orders' },
  { id: 'history', label: 'Account History', icon: History, group: 'Automation & Orders' },

  { id: 'analytics', label: 'Portfolio Analytics', icon: PieChart, group: 'Intelligence & System' },
  { id: 'news', label: 'Market News', icon: Newspaper, group: 'Intelligence & System' },
  { id: 'calendar', label: 'Economic Calendar', icon: Calendar, group: 'Intelligence & System' },
  { id: 'broker-connection', label: 'Broker Connection', icon: PlugZap, group: 'Intelligence & System' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Intelligence & System' },
];

const GROUPS = ['Workspace', 'Asset Classes', 'Automation & Orders', 'Intelligence & System'];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { activeSection, setActiveSection, positions, pendingOrders, bridgeStatus, strategies } =
    useTrading();

  const liveStratCount = strategies.filter((s) => s.isLiveEnabled && s.status === 'ACTIVE').length;

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-60'
      } shrink-0 bg-[#080C15] border-r border-slate-800/80 flex flex-col transition-[width] duration-200 select-none`}
    >
      {/* Brand Lockup */}
      <div className="h-14 px-3.5 border-b border-slate-800/80 flex items-center justify-between">
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-display text-sm font-bold tracking-wide text-white truncate">
              CHARANJEET QUANTX
            </div>
            <div className="text-[10px] tracking-widest text-cyan-400/90 truncate">
              GLOBAL FINANCIAL INTELLIGENCE
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {GROUPS.map((group) => (
          <div key={group} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-slate-500">
                {group}
              </div>
            )}
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              let countLabel: string | null = null;
              if (item.id === 'positions' && positions.length > 0) countLabel = String(positions.length);
              if (item.id === 'pending-orders' && pendingOrders.length > 0)
                countLabel = String(pendingOrders.length);
              if (item.id === 'auto-trading' && liveStratCount > 0)
                countLabel = `${liveStratCount} ON`;

              return (
                <button
                  key={item.id}
                  type="button"
                  title={collapsed ? item.label : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!collapsed && countLabel && (
                    <span className="font-mono-tabular text-[10px] text-cyan-300 shrink-0">
                      {countLabel}
                    </span>
                  )}
                  {!collapsed && item.id === 'broker-connection' && (
                    <span
                      className={`text-[10px] font-mono-tabular shrink-0 ${
                        bridgeStatus.connected ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {bridgeStatus.connected ? 'MT5' : 'OFF'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
