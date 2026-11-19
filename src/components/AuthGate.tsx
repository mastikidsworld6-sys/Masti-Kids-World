import React from 'react';
import { ShieldCheck, Globe2, Cpu, Terminal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';

export const AuthGate: React.FC = () => {
  const { signInWithGoogle, signingIn, authError } = useAuth();

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col justify-between p-6 md:p-10">
      <header className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl font-bold tracking-tight text-white">
            CHARANJEET QUANTX
          </span>
          <span className="text-xs text-cyan-400 font-medium tracking-wider">
            GLOBAL FINANCIAL INTELLIGENCE
          </span>
        </div>
        <span className="text-xs text-slate-400 font-mono-tabular">
          Institutional Trading Workstation
        </span>
      </header>

      <main className="max-w-5xl w-full mx-auto my-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
            Broker-Connected Execution & Global Liquidity Intelligence
          </h1>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-2xl">
            Connect directly to your Windows Exness MetaTrader 5 terminal via an authenticated Python MT5 Bridge, monitor live institutional market depth, run deterministic risk-capped strategies, and inspect global liquidity flows on a real-time 3D Earth network.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-[#0B101B] border border-slate-800/90 rounded-lg p-4 space-y-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <div className="text-xs font-semibold text-white">Exness MT5 Bridge</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authoritative quotes, symbol specs, and verified order tickets.
              </p>
            </div>
            <div className="bg-[#0B101B] border border-slate-800/90 rounded-lg p-4 space-y-2">
              <Globe2 className="w-4 h-4 text-blue-400" />
              <div className="text-xs font-semibold text-white">3D Liquidity Globe</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive WebGL network mapped to live instruments and positions.
              </p>
            </div>
            <div className="bg-[#0B101B] border border-slate-800/90 rounded-lg p-4 space-y-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <div className="text-xs font-semibold text-white">Deterministic Engine</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strict drawdown, spread, exposure, and emergency-stop controls.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#0B101B] border border-slate-800 rounded-xl p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>Authenticated Operator Session</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-white">
              Sign in to Access Workstation
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your strategies, alerts, workspace layouts, and audit logs are isolated to your verified account. MT5 broker passwords are never stored in the browser.
            </p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void signInWithGoogle()}
            className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            {signingIn ? 'Authenticating Session...' : 'Sign in with Google'}
          </button>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div>No fabricated balances, simulated fills, or synthetic quotes.</div>
            <div>Explicit live activation required for automated trading.</div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/80 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <span>CHARANJEET QUANTX · Global Financial Intelligence</span>
        <span>Zero-Trust Session · HTTPS / WSS Relay Architecture</span>
      </footer>
    </div>
  );
};
