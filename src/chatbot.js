import React, { useEffect, useRef, useState } from "react";
import "./chatbot.css";

const CONFIGURED_API = process.env.REACT_APP_API_URL?.trim();
const API_CANDIDATES = [
  CONFIGURED_API,
  "http://localhost:8501",
  "http://127.0.0.1:8501",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
].filter(Boolean);


async function fetchJson(url, options) {
  const response = await fetch(url, options);

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return data;
}

async function resolveApiBase() {
  const uniqueCandidates = [...new Set(API_CANDIDATES)];

  for (const baseUrl of uniqueCandidates) {
    try {
      await fetchJson(`${baseUrl}/health`, { method: "GET" });
      return baseUrl;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    `Backend introuvable. Ports testes: ${uniqueCandidates
      .map((url) => url.replace(/^https?:\/\//, ""))
      .join(", ")}`
  );
}

async function postJson(apiBase, path, payload) {
  return fetchJson(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function Chatbot() {
  const [chat, setChat] = useState([]);
  const [options, setOptions] = useState([]);
  const [guidedOptions, setGuidedOptions] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("guided");
  const [apiBase, setApiBase] = useState(CONFIGURED_API || "");

  const chatBoxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [chat, loading]);

  function applyResponse(data, currentChat) {
    const botMsg = { sender: "bot", text: data.message || "" };
    setChat([...currentChat, botMsg]);
    setOptions(data.options || []);
    setGuidedOptions(data.guided_options || []);
    setSessionId(data.session_id || null);
    setMode(data.mode || "guided");
  }

  useEffect(() => {
    async function startConversation() {
      setLoading(true);
      setError("");

      try {
        const resolvedApiBase = await resolveApiBase();
        setApiBase(resolvedApiBase);

        const data = await postJson(resolvedApiBase, "/chat", {
          action: "start",
          lang: "fr",
          session_id: null,
        });

        applyResponse(data, []);
      } catch (err) {
        console.error(err);
        setError(err.message || "Impossible de joindre le backend.");
      } finally {
        setLoading(false);
      }
    }

    startConversation();
  }, []);

  async function handleOptionClick(option) {
    if (loading || !apiBase) return;

    const newChat = [...chat, { sender: "user", text: option }];
    setChat(newChat);
    setOptions([]);
    setGuidedOptions([]);
    setLoading(true);
    setError("");

    try {
      const data = await postJson(apiBase, "/chat", {
        action: "guided",
        message: option,
        session_id: sessionId,
      });
      applyResponse(data, newChat);
    } catch (err) {
      console.error(err);
      setError(`La reponse du backend n'a pas pu etre recuperee: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSuggestionClick(suggestion) {
    if (loading || !apiBase) return;

    const newChat = [...chat, { sender: "user", text: suggestion }];
    setChat(newChat);
    setOptions([]);
    setGuidedOptions([]);
    setLoading(true);
    setError("");

    try {
      const data = await postJson(apiBase, "/chat", {
        action: "guided",
        message: suggestion,
        session_id: sessionId,
      });
      applyResponse(data, newChat);
    } catch (err) {
      console.error(err);
      setError(`La reponse du backend n'a pas pu etre recuperee: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendText(e) {
    e.preventDefault();
    if (!message.trim() || loading || !apiBase) return;

    const userText = message.trim();
    const newChat = [...chat, { sender: "user", text: userText }];
    setChat(newChat);
    setMessage("");
    setOptions([]);
    setGuidedOptions([]);
    setLoading(true);
    setError("");

    try {
      const data = await postJson(apiBase, "/chat", {
        action: "text",
        message: userText,
        session_id: sessionId,
      });
      applyResponse(data, newChat);
    } catch (err) {
      console.error(err);
      setError(`Le message n'a pas pu etre envoye au backend: ${err.message}`);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const TypingIndicator = () => (
    <div className="message bot-msg typing-indicator">
      <span /><span /><span />
    </div>
  );

  const hasMainOptions = options.length > 0;
  const hasSuggestions = guidedOptions.length > 0 && !hasMainOptions;

  return (
    <div className="chatbot-page">
      <div className="chat-card">
        <div className="chat-box" ref={chatBoxRef}>
          {chat.map((msg, i) => (
            <div
              key={i}
              className={msg.sender === "user" ? "message user-msg" : "message bot-msg"}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
          ))}
          {loading && <TypingIndicator />}
        </div>

        {error && <div className="message bot-msg error-msg">{error}</div>}

        {hasMainOptions && !loading && (
          <div className="options options-main">
            {options.map((opt, i) => (
              <button
                key={i}
                className="option-btn"
                onClick={() => handleOptionClick(opt)}
                disabled={loading}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {hasSuggestions && !loading && (
          <div className="options-suggestions">
            <p className="suggestions-label">Questions frequentes :</p>
            <div className="options options-secondary">
              {guidedOptions.map((opt, i) => (
                <button
                  key={i}
                  className="option-btn option-btn-secondary"
                  onClick={() => handleSuggestionClick(opt)}
                  disabled={loading}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="input-area" onSubmit={handleSendText}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ecrire un message (parler a un conseiller)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={loading || !apiBase}
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !message.trim() || !apiBase}>
            Envoyer
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chatbot;

