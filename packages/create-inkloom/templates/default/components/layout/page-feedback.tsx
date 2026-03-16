import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router";
import { useSiteData } from "@/src/data-provider";
import { Check } from "lucide-react";

type Reaction = "positive" | "neutral" | "negative";

interface ReactionOption {
  type: Reaction;
  emoji: string;
  label: string;
}

const REACTIONS: ReactionOption[] = [
  { type: "positive", emoji: "\u{1F60A}", label: "Helpful" },
  { type: "neutral", emoji: "\u{1F610}", label: "Neutral" },
  { type: "negative", emoji: "\u{1F61E}", label: "Not helpful" },
];

const SESSION_ID_KEY = "inkloom-feedback-session";
const FEEDBACK_STORE_KEY = "inkloom-page-feedback";

function getSessionId(): string {
  if (typeof localStorage === "undefined") return "";
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

/** Read stored reactions map from localStorage. */
function getStoredReactions(): Record<string, Reaction> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(FEEDBACK_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Reaction>) : {};
  } catch {
    return {};
  }
}

function storeReaction(pageSlug: string, reaction: Reaction) {
  if (typeof localStorage === "undefined") return;
  const map = getStoredReactions();
  map[pageSlug] = reaction;
  localStorage.setItem(FEEDBACK_STORE_KEY, JSON.stringify(map));
}

export function PageFeedback() {
  const { pathname } = useLocation();
  const siteData = useSiteData();
  const { config } = siteData;

  const pageSlug = pathname.replace(/^\/+|\/+$/g, "") || "index";
  const projectId = siteData.projectId;

  const [selected, setSelected] = useState<Reaction | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  // Restore any previous vote from localStorage when the page changes
  useEffect(() => {
    const stored = getStoredReactions()[pageSlug];
    setSelected(stored ?? null);
    setSubmitted(false);
  }, [pageSlug]);

  const submitReaction = useCallback(
    async (reaction: Reaction) => {
      const proxyUrl = config.proxyUrl;
      const apiUrl = config.apiUrl;
      if (!proxyUrl || !apiUrl || !projectId) return;

      setSending(true);
      setSelected(reaction);
      storeReaction(pageSlug, reaction);

      try {
        const targetUrl = `${apiUrl.replace(/\/$/, "")}/api/page-feedback`;

        // Route through the CORS proxy worker
        await fetch(`${proxyUrl.replace(/\/$/, "")}/proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: targetUrl,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              pageSlug,
              reaction,
              sessionId: getSessionId(),
            }),
          }),
        });

        setSubmitted(true);
      } catch (err) {
        console.error("[page-feedback] Submit failed:", err);
        // Still show as submitted locally — the vote is persisted in localStorage
        setSubmitted(true);
      } finally {
        setSending(false);
      }
    },
    [config.proxyUrl, config.apiUrl, projectId, pageSlug]
  );

  // Don't render if required config is missing (OSS / local mode)
  if (!config.proxyUrl || !config.apiUrl || !projectId) return null;

  return (
    <div className="page-feedback">
      <div className="page-feedback-divider" />

      {submitted && selected ? (
        <div className="page-feedback-thanks">
          <Check className="page-feedback-check-icon" />
          <span>Thanks for your feedback</span>
        </div>
      ) : (
        <>
          <p className="page-feedback-title">Was this page helpful?</p>
          <div className="page-feedback-buttons">
            {REACTIONS.map(({ type, emoji, label }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                title={label}
                disabled={sending}
                className={`page-feedback-btn${selected === type ? " page-feedback-btn-selected" : ""}`}
                onClick={() => submitReaction(type)}
              >
                <span className="page-feedback-emoji" role="img" aria-hidden="true">
                  {emoji}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
