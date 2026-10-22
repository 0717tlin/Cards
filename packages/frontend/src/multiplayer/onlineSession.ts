import { create } from "zustand";
import type { Move, OnlineMove, RoomCommand, RoomMessage, RoomSession, RoomView, SharedDeck } from "@card-game/engine";
import { setOnlineSender, useBattleStore } from "../store/battleStore";
import { useAppView } from "../navigation/useAppView";

const KEY = "card-battle.online-session.v1";
interface StoredSession extends RoomSession { pending?: OnlineMove; leaving?: boolean }
function loadSession(): StoredSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "null") as StoredSession | null;
    return value && /^[A-Z0-9]{6}$/.test(value.code) && /^[a-f0-9]{64}$/.test(value.token) ? value : null;
  } catch { return null; }
}
let session: StoredSession | null = null;
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let pulse: ReturnType<typeof setInterval> | null = null;
let attempts = 0;
let stopped = true;
let restored = false;

interface OnlineStore {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "error";
  room: RoomView | null;
  error: string | null;
  leaving: boolean;
  createRoom: (name: string) => void;
  joinRoom: (name: string, code: string) => void;
  ready: (deck: SharedDeck | null) => void;
  leave: () => void;
  reconnect: () => void;
}
export const useOnlineSession = create<OnlineStore>(() => ({
  status: "idle", room: null, error: null, leaving: false,
  createRoom: name => begin({ type: "create", name }),
  joinRoom: (name, code) => begin({ type: "join", name, code: code.trim().toUpperCase() }),
  ready: deck => { useOnlineSession.setState({ error: null }); send({ type: "ready", ready: !!deck, deck: deck ?? undefined }); },
  leave: () => {
    if (session?.leaving) return;
    if (session && socket?.readyState !== WebSocket.OPEN) {
      useOnlineSession.setState({ error: "Reconnect before leaving the room so the server can notify your opponent." }); return;
    }
    if (!session) { finishLeaving(); return; }
    session.leaving = true; saveSession(); useOnlineSession.setState({ leaving: true });
    useBattleStore.setState({ busy: true, humanMoves: [] }); send({ type: "leave" });
  },
  reconnect: () => { if (session) { stopped = false; connect({ type: "resume", ...session }); } },
}));

function finishLeaving() {
  stop(); session = null; saveSession();
  useOnlineSession.setState({ status: "idle", room: null, error: null, leaving: false });
  useBattleStore.getState().newGame(); useAppView.getState().setView("online");
}

function saveSession() {
  try { if (session) localStorage.setItem(KEY, JSON.stringify(session)); else localStorage.removeItem(KEY); }
  catch { useOnlineSession.setState({ error: "Browser storage is unavailable. Keep this tab open to stay in the room." }); }
}
function stop() {
  stopped = true;
  if (retry) clearTimeout(retry); retry = null;
  if (pulse) clearInterval(pulse); pulse = null;
  const old = socket; socket = null; old?.close();
  setOnlineSender(null); useBattleStore.getState().onlineConnection(false);
}
function send(command: RoomCommand | { type: "ping" }) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(command));
}
function begin(command: RoomCommand) {
  if (session) { useOnlineSession.setState({ error: "Leave your current room before joining another." }); return; }
  stop(); stopped = false; attempts = 0;
  useOnlineSession.setState({ room: null, error: null }); connect(command);
}
function sendMove(move: Move) {
  useOnlineSession.setState({ error: null });
  const room = useOnlineSession.getState().room;
  if (!session || !room || socket?.readyState !== WebSocket.OPEN) {
    useBattleStore.getState().onlineConnection(false, "Reconnecting…"); return;
  }
  // getRandomValues also works on HTTP LAN origins where randomUUID is unavailable.
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
  session.pending = { type: "move", id, revision: room.revision, move };
  saveSession(); send(session.pending);
}
function connect(auth: RoomCommand) {
  if (retry) clearTimeout(retry); retry = null;
  if (pulse) clearInterval(pulse); pulse = null;
  const old = socket; socket = null; old?.close();
  useOnlineSession.setState({ status: session ? "reconnecting" : "connecting", error: null });
  useBattleStore.getState().onlineConnection(false);
  const url = new URL("/api/multiplayer", window.location.href); url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const current = new WebSocket(url); socket = current;
  let lastMessage = Date.now();
  const openingTimeout = setTimeout(() => { if (current.readyState !== WebSocket.OPEN) current.close(); }, 12_000);
  current.onopen = () => {
    if (socket !== current) return;
    clearTimeout(openingTimeout); send(auth);
    pulse = setInterval(() => {
      if (Date.now() - lastMessage > 25_000) current.close(); else send({ type: "ping" });
    }, 5_000);
  };
  current.onmessage = event => {
    if (socket !== current) return;
    lastMessage = Date.now();
    let message: RoomMessage;
    try { message = JSON.parse(String(event.data)) as RoomMessage; } catch { current.close(); return; }
    if (message.type === "pong") return;
    if (message.type === "left") { finishLeaving(); return; }
    if (message.type === "session") { session = message.session; saveSession(); return; }
    if (message.type === "error") {
      if (message.fatal) {
        if (session?.leaving) { finishLeaving(); return; }
        stop(); session = null; saveSession();
        useOnlineSession.setState({ status: "error", room: null, error: message.message });
        useBattleStore.getState().newGame(); useAppView.getState().setView("online");
      } else {
        if (session?.leaving) { delete session.leaving; saveSession(); useOnlineSession.setState({ leaving: false }); }
        if (session?.pending) { delete session.pending; saveSession(); }
        useOnlineSession.setState({ status: session ? "connected" : "error", error: message.message });
        useBattleStore.getState().onlineConnection(!!session, message.message);
      }
      return;
    }
    if (message.type === "room") {
      attempts = 0;
      const previousRoom = useOnlineSession.getState().room;
      const enteringBattle = message.room.battle && (!previousRoom?.battle || previousRoom.code !== message.room.code);
      if (session?.pending && message.ack === session.pending.id) { delete session.pending; saveSession(); }
      const error = message.ack || message.resumed ? null : useOnlineSession.getState().error;
      useOnlineSession.setState({ status: "connected", room: message.room, error });
      setOnlineSender(sendMove); useBattleStore.getState().onlineConnection(true, error ?? undefined);
      useBattleStore.getState().receiveOnline(message.room, message.resumed);
      if (message.resumed && session?.leaving) send({ type: "leave" });
      else if (message.resumed && session?.pending) send(session.pending);
      if (session?.pending) useBattleStore.setState({ busy: true, humanMoves: [] });
      if (enteringBattle && useAppView.getState().view === "online") useAppView.getState().setView("battle");
      return;
    }
  };
  current.onerror = () => { /* close drives reconnect and reports an actionable message */ };
  current.onclose = () => {
    clearTimeout(openingTimeout);
    if (socket !== current) return;
    socket = null;
    if (pulse) clearInterval(pulse); pulse = null;
    useBattleStore.getState().onlineConnection(false, "Connection lost. Reconnecting…");
    if (stopped) return;
    if (session) {
      useOnlineSession.setState({ status: "reconnecting", error: "Connection lost. Reconnecting…" });
      retry = setTimeout(() => { if (session && !stopped) connect({ type: "resume", ...session }); }, Math.min(10_000, 500 * 2 ** attempts++));
    } else {
      useOnlineSession.setState({ status: "error", error: "Couldn't connect. Check that the backend is running, then try again." });
    }
  };
}

/** Called once by the app. Credentials stay in this browser; they never appear in room codes or URLs. */
export function restoreOnlineSession() {
  if (restored || typeof window === "undefined" || typeof WebSocket === "undefined") return;
  restored = true; session = loadSession();
  if (session) { stopped = false; useOnlineSession.setState({ leaving: !!session.leaving }); useAppView.getState().setView("online"); connect({ type: "resume", ...session }); }
  window.addEventListener("online", () => { if (session && !stopped && socket?.readyState !== WebSocket.OPEN) connect({ type: "resume", ...session }); });
}

// Close the replaced module's socket before the new module resumes the saved guest.
if (import.meta.hot) {
  import.meta.hot.dispose(() => stop());
  // Reload once so the saved guest reconnects after a development module replacement.
  import.meta.hot.accept(() => window.location.reload());
}
