# CHARANJEET QUANTX — Windows Python MT5 Bridge Setup

The **MetaTrader5** official Python package communicates directly over Windows IPC with an active **Exness MetaTrader 5 Desktop Terminal**. Because cloud Linux containers cannot run a persistent Windows MT5 terminal, you run this lightweight bridge on your Windows PC or Windows VPS.

## 1. Prerequisites (Windows 10/11 or Windows Server VPS)
1. Install **Exness MetaTrader 5** desktop terminal and log into your Exness Live or Practice account.
2. Enable **Algo Trading** in MT5 (`Tools -> Options -> Expert Advisors -> Allow algorithmic trading`).
3. Install **Python 3.11 or 3.12 (64-bit)** from python.org.

## 2. Install & Configure the Bridge
```powershell
cd mt5-bridge
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```
Edit `.env` and set a strong `MT5_BRIDGE_SECRET` (at least 32 random characters).

## 3. Start the Bridge Locally
```powershell
uvicorn main:app --host 127.0.0.1 --port 8765
```

## 4. Expose Over Encrypted HTTPS / WSS
Never expose port 8765 over plain HTTP on the public internet. Use an authenticated HTTPS tunnel such as **Cloudflare Tunnel** (`cloudflared tunnel --url http://127.0.0.1:8765`) or an Nginx TLS reverse proxy with an IP allowlist.

## 5. Connect from CHARANJEET QUANTX
1. Open **Broker Connection** inside CHARANJEET QUANTX.
2. Enter your HTTPS Bridge URL (e.g. `https://your-mt5-bridge.example.com`) and your `MT5_BRIDGE_SECRET`.
3. Optionally enter your Exness MT5 Login, Server (e.g. `Exness-MT5Real9` or `Exness-MT5Trial10`), and Password—or leave login blank to attach to the already authenticated MT5 terminal session.
4. Click **Connect Exness MT5**. Your credentials are relayed strictly to your bridge over HTTPS and are never stored in browser storage or logs.
