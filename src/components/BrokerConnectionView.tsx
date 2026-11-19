import React, { useState } from 'react';
import {
  PlugZap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Server,
  PowerOff,
  TerminalSquare,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';

export const BrokerConnectionView: React.FC = () => {
  const { bridgeStatus, bridgeConfigs, connectMt5Bridge, disconnectMt5Bridge, mt5Symbols } =
    useTrading();

  const [bridgeUrl, setBridgeUrl] = useState('https://your-windows-mt5-bridge.example.com');
  const [bridgeToken, setBridgeToken] = useState('');
  const [login, setLogin] = useState('');
  const [server, setServer] = useState('Exness-MT5Real');
  const [password, setPassword] = useState('');
  const [saveProfileLabel, setSaveProfileLabel] = useState('Exness Primary Desk');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const status = await connectMt5Bridge({
        bridgeUrl,
        bridgeToken,
        login: login || undefined,
        password: password || undefined,
        server: server || undefined,
        saveProfileLabel: saveProfileLabel || undefined,
      });
      setPassword(''); // Never retain password in component state after relay
      setSuccessMsg(
        `Connected to ${status.account?.broker || 'Exness'} (${status.account?.server || 'MT5'}) · Account #${status.account?.login || 'Active'} (${status.account?.accountType})`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach Windows Python MT5 Bridge. Verify the bridge process and HTTPS endpoint.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setSuccessMsg(null);
    await disconnectMt5Bridge();
  };

  const acc = bridgeStatus.account;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Exness MT5 Broker Connection
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authenticated HTTPS / WSS link to your Windows Python MetaTrader 5 Bridge. Credentials are never stored in browser storage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-mono-tabular px-3 py-1 rounded border ${
              bridgeStatus.connected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            {bridgeStatus.connected ? 'BRIDGE ONLINE' : 'BRIDGE DISCONNECTED'}
          </span>
          {bridgeStatus.connected && (
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-red-300 text-xs font-semibold rounded cursor-pointer"
            >
              <PowerOff className="w-3.5 h-3.5" />
              Disconnect Session
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Connection Form */}
        <form
          onSubmit={(e) => void handleConnect(e)}
          className="lg:col-span-6 bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
            <PlugZap className="w-4 h-4" />
            <span>Connect Existing Exness MT5 Account</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Broker Selection</label>
            <select
              disabled
              value="Exness MT5"
              className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
            >
              <option value="Exness MT5">Exness (MetaTrader 5 Official Python Bridge)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Windows Python MT5 Bridge HTTPS URL</label>
            <input
              type="url"
              required
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="https://your-bridge-tunnel.trycloudflare.com"
              className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Bridge Auth Secret (MT5_BRIDGE_SECRET)</label>
            <input
              type="password"
              required
              value={bridgeToken}
              onChange={(e) => setBridgeToken(e.target.value)}
              placeholder="Enter bearer token configured on Windows bridge"
              className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">MT5 Login (optional if already logged in)</label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">MT5 Server Name</label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="Exness-MT5Real / Exness-MT5Trial"
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 font-mono-tabular text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">MT5 Password (never persisted)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for active terminal session"
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Profile Label (Endpoint Only)</label>
              <input
                type="text"
                value={saveProfileLabel}
                onChange={(e) => setSaveProfileLabel(e.target.value)}
                className="w-full bg-[#060911] border border-slate-800 rounded px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold">Genuine Connection Error</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={connecting}
            className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            {connecting ? 'Authenticating with Exness MT5 Bridge...' : 'Connect Exness MT5'}
          </button>
        </form>

        {/* Live Broker Telemetry & Windows Setup Guide */}
        <div className="lg:col-span-6 space-y-5">
          {/* Broker-Reported Account Metadata */}
          <div className="bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Synchronized Broker Telemetry</span>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {bridgeStatus.lastSync
                  ? `Sync ${new Date(bridgeStatus.lastSync).toISOString().slice(11, 19)} UTC`
                  : 'Not synchronized'}
              </span>
            </div>

            {acc ? (
              <div className="grid grid-cols-2 gap-y-2 text-xs border-t border-slate-800 pt-3">
                <div className="text-slate-400">Broker</div>
                <div className="text-right text-white font-medium">{acc.broker}</div>

                <div className="text-slate-400">Account Type (Broker-Reported)</div>
                <div className="text-right text-cyan-300 font-semibold">{acc.accountType}</div>

                <div className="text-slate-400">Login / Server</div>
                <div className="text-right font-mono-tabular text-slate-200">
                  #{acc.login} · {acc.server}
                </div>

                <div className="text-slate-400">Currency / Leverage</div>
                <div className="text-right font-mono-tabular text-slate-200">
                  {acc.currency} · 1:{acc.leverage}
                </div>

                <div className="text-slate-400">Trading Permissions</div>
                <div className="text-right text-slate-200">
                  Manual: {acc.tradeAllowed ? 'Allowed' : 'Disabled'} · Algo:{' '}
                  {acc.algoTradingAllowed ? 'Allowed' : 'Disabled'}
                </div>

                <div className="text-slate-400">Broker Symbols Loaded</div>
                <div className="text-right font-mono-tabular text-emerald-400">
                  {mt5Symbols.length} instruments
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4 text-center border-t border-slate-800">
                No active MT5 account session. Connect your Windows Python MT5 Bridge to retrieve real account equity, leverage, permissions, and broker symbols.
              </div>
            )}
          </div>

          {/* Windows Python MT5 Bridge Instructions */}
          <div className="bg-[#0B101B] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <TerminalSquare className="w-4 h-4 text-blue-400" />
              <span>Windows PC / VPS Python MT5 Bridge Setup</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed">
              <li>Open <strong>Exness MetaTrader 5</strong> on Windows and sign in to your account.</li>
              <li>Enable <strong>Algo Trading</strong> inside MT5 (Tools &rarr; Options &rarr; Expert Advisors).</li>
              <li>Run the included <code className="text-cyan-300">mt5-bridge/main.py</code> FastAPI service on Python 3.11+ with <code className="text-cyan-300">MT5_BRIDGE_SECRET</code> set.</li>
              <li>Expose the bridge securely via HTTPS (e.g. Cloudflare Tunnel or TLS reverse proxy) and enter the URL above.</li>
            </ol>
            <div className="bg-[#060911] border border-slate-800 rounded p-2.5 font-mono-tabular text-[11px] text-cyan-300 overflow-x-auto">
              cd mt5-bridge && pip install -r requirements.txt && uvicorn main:app --host 127.0.0.1 --port 8765
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Saved Endpoint Profiles: {bridgeConfigs.length} (passwords excluded)</span>
            </div>
            {bridgeConfigs.length > 0 && (
              <div className="space-y-1 pt-1">
                {bridgeConfigs.map((cfg) => (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={() => {
                      setBridgeUrl(cfg.bridgeUrl);
                      setLogin(cfg.mt5Login);
                      setServer(cfg.mt5Server);
                    }}
                    className="w-full text-left px-2.5 py-1.5 bg-[#060911] hover:bg-slate-800/70 border border-slate-800 rounded text-xs flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-slate-200 font-medium">{cfg.label}</span>
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      #{cfg.mt5Login} · {cfg.mt5Server}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
