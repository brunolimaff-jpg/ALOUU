
import { ChatSession, Message } from "../types";
import { withAutoRetry } from "../utils/retry";
import { normalizeAppError } from "../utils/errorHelpers";
import { BACKEND_URL } from "./apiConfig";

// URL agora vem do apiConfig
const SESSIONS_API_URL = BACKEND_URL;

interface RemoteSessionRow {
  sessionId: string;
  userId?: string;
  userName?: string; 
  title: string;
  empresaAlvo: string;
  cnpj: string;
  createdAt: string;
  updatedAt: string;
  messagesJson?: string;
  scoreOportunidade?: number | string;
  resumoDossie?: string;
}

export async function listRemoteSessions(): Promise<ChatSession[]> {
  const apiCall = async () => {
    // GET requests generally work, but we use post for actions usually. 
    // If the backend supports GET for list, great. If not, this might need adjustment to POST with action='list'.
    // Assuming backend handles GET for listing based on previous context, but ensuring we point to 'exec'.
    const res = await fetch(SESSIONS_API_URL, {
        method: "GET",
        redirect: "follow",
        headers: { "Content-Type": "text/plain" }
    });
    
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    // Safely read body once
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid JSON response from server");
    }

    if (!data.ok) throw new Error("Logical API error");
    return data.sessions || [];
  };

  try {
    const rows = await withAutoRetry<RemoteSessionRow[]>('RemoteStore:list', apiCall, { maxRetries: 2 });
    
    return rows.map((r) => ({
      id: r.sessionId,
      title: r.title || "Sessão sem título",
      empresaAlvo: r.empresaAlvo || null,
      cnpj: r.cnpj || null,
      modoPrincipal: null,
      scoreOportunidade: r.scoreOportunidade ? Number(r.scoreOportunidade) : null,
      resumoDossie: r.resumoDossie || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      messages: [] 
    }));
  } catch (error) {
    console.warn("Failed to list remote sessions", error);
    return []; // Fail gracefully for listing
  }
}

export async function getRemoteSession(id: string): Promise<ChatSession | null> {
  const apiCall = async () => {
    const url = `${SESSIONS_API_URL}?sessionId=${encodeURIComponent(id)}`;
    const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "Content-Type": "text/plain" }
    });

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    // Safely read body once
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid JSON response from server");
    }

    if (!data.ok || !data.session) return null;
    return data.session as RemoteSessionRow;
  };

  try {
    const s = await withAutoRetry('RemoteStore:get', apiCall, { maxRetries: 2 });
    if (!s) return null;

    let messages: Message[] = [];
    if (s.messagesJson) {
      try {
        const parsed = JSON.parse(s.messagesJson);
        messages = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
        }));
      } catch { messages = []; }
    }

    return {
      id: s.sessionId,
      title: s.title || "Sessão sem título",
      empresaAlvo: s.empresaAlvo || null,
      cnpj: s.cnpj || null,
      modoPrincipal: null,
      scoreOportunidade: s.scoreOportunidade ? Number(s.scoreOportunidade) : null,
      resumoDossie: s.resumoDossie || null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messages
    };
  } catch (error) {
    console.error("Failed to get remote session", error);
    return null;
  }
}

export async function saveRemoteSession(session: ChatSession, userId?: string, userName?: string) {
  const payload = {
    action: "saveSession", // Explicit action if needed by backend, otherwise payload structure usually suffices
    session: {
      id: session.id,
      userId: userId || "user_default",
      userName: userName || "Convidado",
      title: session.title,
      empresaAlvo: session.empresaAlvo,
      cnpj: session.cnpj,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages,
      scoreOportunidade: session.scoreOportunidade,
      resumoDossie: session.resumoDossie
    }
  };

  const apiCall = async () => {
    const res = await fetch(SESSIONS_API_URL, {
        method: "POST",
        redirect: "follow",
        // CRITICAL FOR APPS SCRIPT CORS: Use text/plain
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    
    // Safely read body once
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Invalid JSON response from server");
    }

    if (!data.ok) throw new Error(data.message || "Save failed");
    return data;
  };

  // We let this throw so the UI can show the error status
  return await withAutoRetry('RemoteStore:save', apiCall, { maxRetries: 3 });
}
