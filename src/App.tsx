/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { TradingProvider, useTrading } from './contexts/TradingContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { MarketWatchPanel } from './components/MarketWatchPanel.tsx';
import { TradingChart } from './components/TradingChart.tsx';
import { LiquidityGlobe } from './components/LiquidityGlobe.tsx';
import { OrderBookPanel } from './components/OrderBookPanel.tsx';
import { OrderEntryPanel } from './components/OrderEntryPanel.tsx';
import { BottomDock } from './components/BottomDock.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { AssetCategoryView } from './components/AssetCategoryView.tsx';
import { AutoTradingWorkspace } from './components/AutoTradingWorkspace.tsx';
import { OrdersLedgerView } from './components/OrdersLedgerView.tsx';
import { PortfolioAnalyticsView } from './components/PortfolioAnalyticsView.tsx';
import { MarketIntelligenceView } from './components/MarketIntelligenceView.tsx';
import { BrokerConnectionView } from './components/BrokerConnectionView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

const TerminalWorkspace: React.FC = () => {
  const { terminalTab, setActiveSection } = useTrading();
  const [showOrderBook, setShowOrderBook] = useState(true);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: MT5 Market Watch */}
        <div className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col overflow-hidden">
          <MarketWatchPanel />
        </div>

        {/* Center: Multi-tab Charting OR Docked 3D Liquidity Globe + Optional Order Book */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-slate-800/80">
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full overflow-hidden">
              {terminalTab === 'CHART' ? (
                <TradingChart />
              ) : (
                <LiquidityGlobe onToggleExpand={() => setActiveSection('globe')} />
              )}
            </div>
            {showOrderBook && (
              <div className="hidden 2xl:flex w-64 shrink-0 flex-col border-l border-slate-800/80 bg-[#080C15] overflow-y-auto">
                <OrderBookPanel />
              </div>
            )}
          </div>
          <div className="2xl:hidden shrink-0 border-t border-slate-800/80 bg-[#080C15]">
            <button
              type="button"
              onClick={() => setShowOrderBook((v) => !v)}
              className="w-full px-3 py-1 text-[11px] text-slate-400 hover:text-white flex items-center justify-between cursor-pointer"
            >
              <span>Actual Market Depth &amp; Analytical Zones</span>
              <span>{showOrderBook ? 'Hide' : 'Show'}</span>
            </button>
            {showOrderBook && (
              <div className="max-h-48 overflow-y-auto">
                <OrderBookPanel />
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Entry & Read-Only AI Analyst */}
        <div className="hidden md:flex w-72 xl:w-80 shrink-0 flex-col overflow-hidden">
          <OrderEntryPanel />
        </div>
      </div>

      {/* Resizable Bottom Terminal Dock */}
      <BottomDock />
    </div>
  );
};

const WorkstationShell: React.FC = () => {
  const { activeSection, setActiveSection } = useTrading();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewView />;
      case 'terminal':
        return <TerminalWorkspace />;
      case 'globe':
        return (
          <LiquidityGlobe
            fullViewport
            onToggleExpand={() => setActiveSection('terminal')}
          />
        );
      case 'market-watch':
        return (
          <AssetCategoryView
            categoryFilter="ALL"
            title="Global Market Watch"
            description="Complete directory of connected Exness MT5 instruments and Binance public spot crypto feeds."
          />
        );
      case 'forex':
        return (
          <AssetCategoryView
            categoryFilter="Forex"
            title="Forex Currency Pairs"
            description="Major, minor, and cross FX pairs synchronized from your connected Exness MT5 broker."
          />
        );
      case 'metals':
        return (
          <AssetCategoryView
            categoryFilter="Metals"
            title="Precious Metals"
            description="Spot Gold (XAU), Silver (XAG), Platinum, and Palladium contracts from Exness MT5."
          />
        );
      case 'commodities':
        return (
          <AssetCategoryView
            categoryFilter="Commodities"
            title="Energy & Commodities"
            description="Crude oil, Brent, and natural gas CFD instruments from your connected MT5 feed."
          />
        );
      case 'indices':
        return (
          <AssetCategoryView
            categoryFilter="Indices"
            title="Global Equity Indices"
            description="US30, US500, USTEC, DE40, UK100, and JP225 index CFDs via Exness MT5."
          />
        );
      case 'stocks':
        return (
          <AssetCategoryView
            categoryFilter="Stocks"
            title="Global Stocks"
            description="Single-stock CFDs routed through your Exness MetaTrader 5 account."
          />
        );
      case 'crypto':
        return (
          <AssetCategoryView
            categoryFilter="Crypto"
            title="Digital Assets & Crypto"
            description="MT5 crypto CFDs paired with live Binance Spot Public reference quotes and L2 depth."
          />
        );
      case 'auto-trading':
        return <AutoTradingWorkspace initialMode="ENGINE" />;
      case 'strategy-builder':
        return <AutoTradingWorkspace initialMode="BUILDER" />;
      case 'positions':
        return <OrdersLedgerView mode="POSITIONS" />;
      case 'pending-orders':
        return <OrdersLedgerView mode="ORDERS" />;
      case 'history':
        return <OrdersLedgerView mode="HISTORY" />;
      case 'analytics':
        return <PortfolioAnalyticsView />;
      case 'news':
        return <MarketIntelligenceView key="news" initialTab="NEWS" />;
      case 'calendar':
        return <MarketIntelligenceView key="calendar" initialTab="CALENDAR" />;
      case 'broker-connection':
        return <BrokerConnectionView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TerminalWorkspace />;
    }
  };

  return (
    <div className="h-screen w-screen bg-[#060911] text-slate-100 flex overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-hidden">{renderSection()}</main>
      </div>
    </div>
  );
};

const AuthRouter: React.FC = () => {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#060911] text-slate-300 flex items-center justify-center text-xs font-mono-tabular">
        Initializing CHARANJEET QUANTX session...
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <TradingProvider>
      <WorkstationShell />
    </TradingProvider>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
