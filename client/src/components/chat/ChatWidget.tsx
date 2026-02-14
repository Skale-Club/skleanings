import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, X, Loader2, RotateCcw, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  trackChatOpen,
  trackChatClose,
  trackChatMessageSent,
  trackChatMessageReceived,
  trackChatNewConversation,
  trackChatLeadCaptured,
  trackChatBookingCompleted,
} from "@/lib/analytics";
import { renderMarkdown } from "@/lib/markdown";

type UrlRule = {
  pattern: string;
  match: "contains" | "starts_with" | "equals";
};

type ChatConfig = {
  enabled: boolean;
  agentName: string;
  agentAvatarUrl?: string;
  fallbackAvatarUrl?: string;
  welcomeMessage: string;
  languageSelectorEnabled?: boolean;
  defaultLanguage?: string;
  excludedUrlRules: UrlRule[];
};

type MessageStatus = "sending" | "sent" | "error";

type ChatMessage = {
  id: string;
  role: "assistant" | "visitor";
  content: string;
  createdAt?: string;
  metadata?: Record<string, any> | null;
  status?: MessageStatus;
};


const STORAGE_KEY = "chat_conversation_id";
const COOKIE_KEY = "chat_conv_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const LOCAL_MESSAGES_KEY = "chat_widget_messages";
const LANGUAGE_KEY = "chat_widget_language";

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function removeCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "es", label: "Spanish" },
];

function matchesRule(url: string, rule: UrlRule) {
  if (!rule?.pattern) return false;
  if (rule.match === "contains") return url.includes(rule.pattern);
  if (rule.match === "starts_with") return url.startsWith(rule.pattern);
  return url === rule.pattern;
}

function isUrlExcluded(url: string, rules: UrlRule[]) {
  return rules?.some((rule) => matchesRule(url, rule));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function formatMessageTime(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ChatBubble = memo(function ChatBubble({
  msg,
  isAssistant,
  avatarUrl,
  displayName,
  onAvatarError,
  onInternalNav,
}: {
  msg: ChatMessage;
  isAssistant: boolean;
  avatarUrl: string;
  displayName: string;
  onAvatarError: () => void;
  onInternalNav: (path: string) => void;
}) {
  const timeStr = formatMessageTime(msg.createdAt);
  return (
    <div className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}>
      {isAssistant && (
        <img
          src={avatarUrl}
          alt={displayName}
          onError={onAvatarError}
          className="h-7 w-7 rounded-full border border-slate-200 object-cover mt-0.5"
        />
      )}
      <div className="max-w-[85%]">
        <div
          className={`rounded-lg px-3 py-2 text-sm ${isAssistant ? "bg-white border text-slate-800" : msg.status === "error" ? "bg-red-500 text-white" : "bg-primary text-white"
            }`}
        >
          <p className="whitespace-pre-wrap break-words leading-snug">
            {renderMarkdown(msg.content, onInternalNav)}
          </p>
        </div>
        {(timeStr || msg.status) && (
          <div className={`flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 ${isAssistant ? "" : "justify-end"}`}>
            {timeStr && <span>{timeStr}</span>}
            {!isAssistant && msg.status === "sending" && <span>Sending...</span>}
            {!isAssistant && msg.status === "sent" && <span>Sent</span>}
            {!isAssistant && msg.status === "error" && <span className="text-red-400">Failed</span>}
          </div>
        )}
      </div>
    </div>
  );
});

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [location, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>();
  const [showOnlineDot, setShowOnlineDot] = useState(false);
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [shouldShowDotAfterClose, setShouldShowDotAfterClose] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [language, setLanguage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const { data: config } = useQuery<ChatConfig>({
    queryKey: ["/api/chat/config"],
    queryFn: async () => {
      const res = await fetch("/api/chat/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chat config");
      return res.json();
    },
  });

  useEffect(() => {
    // Recover conversation ID from localStorage (primary) or cookie (fallback)
    const storedId = localStorage.getItem(STORAGE_KEY) || getCookie(COOKIE_KEY);
    const storedMessages = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (storedId) {
      setConversationId(storedId);
      // Sync both storage mechanisms
      localStorage.setItem(STORAGE_KEY, storedId);
      setCookie(COOKIE_KEY, storedId, COOKIE_MAX_AGE);
    }
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch {
        setMessages([]);
      }
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(STORAGE_KEY, conversationId);
      setCookie(COOKIE_KEY, conversationId, COOKIE_MAX_AGE);
      setLoadingHistory(true);
      fetch(`/api/chat/conversations/${conversationId}/messages?limit=50`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          setHasMore(!!data.hasMore);
          const mapped = (data.messages || [])
            .filter((m: any) => !m?.metadata?.internal)
            .map((m: any) => ({
              id: m.id,
              role: m.role === "assistant" ? "assistant" : "visitor",
              content: m.content,
              createdAt: m.createdAt,
              metadata: m.metadata || null,
            })) as ChatMessage[];

          // If there are real conversation messages (visitor messages), use them
          // and prepend the current welcome message
          const hasRealConversation = mapped.some((m) => m.role === "visitor");

          let merged: ChatMessage[] = [];

          if (hasRealConversation) {
            // Real conversation exists - add current welcome message and all messages
            if (config?.welcomeMessage) {
              merged.push({
                id: makeId(),
                role: "assistant",
                content: config.welcomeMessage,
                createdAt: new Date().toISOString(),
              });
            }
            merged.push(...mapped);
          } else {
            // No real conversation yet - just show current welcome message
            if (config?.welcomeMessage) {
              merged.push({
                id: makeId(),
                role: "assistant",
                content: config.welcomeMessage,
                createdAt: new Date().toISOString(),
              });
            }
          }

          if (merged.length > 0) {
            setMessages(merged);
            localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(merged));
          }
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [conversationId, config?.welcomeMessage]);

  useEffect(() => {
    if (isOpen && config?.welcomeMessage && messages.length === 0) {
      setMessages([
        {
          id: makeId(),
          role: "assistant",
          content: config.welcomeMessage,
        },
      ]);
    }
  }, [isOpen, config?.welcomeMessage, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (!config) return;
    setAvatarSrc(config.agentAvatarUrl || config.fallbackAvatarUrl || "/favicon.png");
  }, [config]);

  useEffect(() => {
    if (!config?.languageSelectorEnabled) return;
    const stored = localStorage.getItem(LANGUAGE_KEY);
    const fallback = config.defaultLanguage || "en";
    setLanguage(stored || fallback);
  }, [config?.languageSelectorEnabled, config?.defaultLanguage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadySeen = sessionStorage.getItem("chat_welcome_shown") === "1";
    setHasShownWelcome(alreadySeen);
  }, []);

  useEffect(() => {
    if (!config?.enabled || isOpen || hasShownWelcome) {
      return;
    }
    const dotTimer = setTimeout(() => setShowOnlineDot(true), 500);
    const bubbleTimer = setTimeout(() => {
      setShowWelcomePreview(true);
      setHasShownWelcome(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("chat_welcome_shown", "1");
      }
    }, 5000);
    return () => {
      clearTimeout(dotTimer);
      clearTimeout(bubbleTimer);
    };
  }, [config?.enabled, isOpen, hasShownWelcome]);

  useEffect(() => {
    if (isOpen) {
      setShowOnlineDot(false);
      setShowWelcomePreview(false);
      setUnreadCount(0);
    } else if (shouldShowDotAfterClose) {
      setShowOnlineDot(true);
    }
  }, [isOpen, shouldShowDotAfterClose]);

  useEffect(() => {
    if (hasShownWelcome) {
      setShouldShowDotAfterClose(true);
    }
  }, [hasShownWelcome]);

  const excluded = useMemo(() => {
    const url = typeof window !== "undefined" ? window.location.pathname : location;
    return config ? isUrlExcluded(url, config.excludedUrlRules || []) : false;
  }, [config, location]);

  const displayName = config?.agentName || "Assistant";
  const avatarUrl = avatarSrc || config?.agentAvatarUrl || config?.fallbackAvatarUrl || "/favicon.png";
  const headerIcon = config?.agentAvatarUrl || config?.fallbackAvatarUrl || "/favicon.png";
  const launcherHasAvatar = Boolean(avatarUrl);

  const handleAvatarError = useCallback(() => {
    if (config?.fallbackAvatarUrl && avatarSrc !== config.fallbackAvatarUrl) {
      setAvatarSrc(config.fallbackAvatarUrl);
    } else {
      setAvatarSrc("/favicon.png");
    }
  }, [config?.fallbackAvatarUrl, avatarSrc]);

  const handleInternalNav = useCallback((path: string) => {
    setLocation(path);
    setIsOpen(true);
  }, [setLocation]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    localStorage.setItem(LANGUAGE_KEY, value);
  };

  const startNewConversation = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOCAL_MESSAGES_KEY);
    removeCookie(COOKIE_KEY);
    setConversationId(null);
    setMessages([]);
    setLimitReached(false);
    trackChatNewConversation(window.location.pathname);
    if (config?.welcomeMessage) {
      setMessages([{ id: makeId(), role: "assistant", content: config.welcomeMessage }]);
    }
  };

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !hasMore || loadingOlder) return;
    // Find the oldest real message (skip the welcome message which has no DB id)
    const firstRealMsg = messages.find((m) => m.id && !m.id.startsWith("w-") && m.id.length > 5);
    if (!firstRealMsg) return;

    setLoadingOlder(true);
    const prevScrollHeight = scrollRef.current?.scrollHeight || 0;

    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages?limit=30&before=${firstRealMsg.id}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setHasMore(!!data.hasMore);
      const older = (data.messages || [])
        .filter((m: any) => !m?.metadata?.internal)
        .map((m: any) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "visitor",
          content: m.content,
          createdAt: m.createdAt,
          metadata: m.metadata || null,
        })) as ChatMessage[];

      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
          }
        });
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, messages]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !hasMore || loadingOlder) return;
    if (scrollRef.current.scrollTop < 60) {
      loadOlderMessages();
    }
  }, [hasMore, loadingOlder, loadOlderMessages]);

  const sendMessageWithRetry = async (content: string, retryCount = 0): Promise<void> => {
    const payload = {
      conversationId: conversationId || undefined,
      message: content,
      pageUrl: window.location.pathname,
      userAgent: navigator.userAgent,
      language: language || config?.defaultLanguage,
    };

    const res = await apiRequest("POST", "/api/chat/message", payload);
    const data = await res.json();

    if (data.limitReached) {
      setLimitReached(true);
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: data.message, createdAt: new Date().toISOString() },
      ]);
      return;
    }

    if (data.conversationId && data.conversationId !== conversationId) {
      setConversationId(data.conversationId);
    }
    const assistantMessage: ChatMessage = {
      id: makeId(),
      role: "assistant",
      content: data.response || "Thanks for reaching out!",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
    if (!isOpen) setUnreadCount((c) => c + 1);
    trackChatMessageReceived(window.location.pathname, data.conversationId || conversationId || undefined);

    if (data.leadCaptured) {
      trackChatLeadCaptured(window.location.pathname, data.conversationId || conversationId || undefined);
    }
    if (data.bookingCompleted) {
      trackChatBookingCompleted(
        window.location.pathname,
        data.conversationId || conversationId || undefined,
        data.bookingCompleted.value,
        data.bookingCompleted.services
      );
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isSending || limitReached) return;

    const msgId = makeId();
    const visitorMessage: ChatMessage = {
      id: msgId,
      role: "visitor",
      content,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, visitorMessage]);
    setInput("");
    setIsSending(true);
    trackChatMessageSent(window.location.pathname, conversationId || undefined);

    const markVisitorStatus = (status: MessageStatus) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, status } : m)));
    };

    try {
      await sendMessageWithRetry(content);
      markVisitorStatus("sent");
    } catch (error: any) {
      const errorData = error?.data || {};

      // Auto-retry once on network failure
      if (!errorData.limitReached) {
        try {
          await new Promise((r) => setTimeout(r, 1500));
          await sendMessageWithRetry(content);
          markVisitorStatus("sent");
          return;
        } catch {
          // Retry also failed, fall through to error handling
        }
      }

      markVisitorStatus("error");

      if (errorData.limitReached) {
        setLimitReached(true);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: errorData.message || "This conversation has reached the message limit. Please start a new conversation.", createdAt: new Date().toISOString() },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: "Sorry, I couldn't process your message. Please check your connection and try again.", createdAt: new Date().toISOString() },
        ]);
      }
    } finally {
      setIsSending(false);
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        trackChatOpen(window.location.pathname);
      } else {
        trackChatClose(window.location.pathname, messages.length);
      }
      return willOpen;
    });
  };

  const renderLauncher = () => {
    if (isOpen) return null;

    return (
      <div className="relative mb-2 flex items-center justify-end">
        {config?.welcomeMessage && (
          <button
            type="button"
            onClick={toggleOpen}
            aria-hidden={!showWelcomePreview}
            tabIndex={showWelcomePreview ? 0 : -1}
            className={`absolute right-16 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${showWelcomePreview ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
          >
            <div className="relative bg-white drop-shadow-[2px_2px_6px_rgba(15,23,42,0.12)] rounded-2xl px-4 py-3 text-sm w-[240px] text-left">
              <p className="leading-snug">{config.welcomeMessage}</p>
              <div className="absolute -right-[6px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white" />
            </div>
          </button>
        )}
        <Button
          variant={launcherHasAvatar ? "ghost" : "default"}
          className={`group rounded-full h-14 w-14 p-0 relative ${launcherHasAvatar
              ? "bg-transparent hover:bg-transparent border-transparent shadow-none"
              : "bg-primary text-white shadow-[2px_2px_6px_rgba(15,23,42,0.12)]"
            }`}
          onClick={toggleOpen}
          data-testid="button-open-chat"
          aria-label="Open chat"
          onMouseEnter={() => setShowOnlineDot(true)}
        >
          {launcherHasAvatar ? (
            <div className="relative h-14 w-14">
              <div
                className="pointer-events-none absolute inset-0.5 rounded-full shadow-[2px_2px_6px_rgba(15,23,42,0.12)]"
                aria-hidden="true"
              />
              <div className="h-full w-full rounded-full overflow-hidden bg-white">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="block h-full w-full origin-center object-cover scale-[1.01] transition-transform group-hover:scale-[1.03]"
                  onError={handleAvatarError}
                />
              </div>
              <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-white" />
            </div>
          ) : (
            <UserCircle className="w-7 h-7" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {showOnlineDot && unreadCount === 0 && (
            <span className="absolute bottom-0 right-0 translate-x-0 -translate-y-[2px] h-3.5 w-3.5 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white shadow-sm" />
          )}
        </Button>
      </div>
    );
  };

  if (!config?.enabled || excluded) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {renderLauncher()}

      {isOpen && (
        <div className="w-80 sm:w-96 shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between bg-primary text-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white border border-white/40 overflow-hidden flex items-center justify-center">
                <img
                  src={headerIcon}
                  alt="Company icon"
                  className="h-full w-full object-cover"
                  onError={handleAvatarError}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Chat</p>
                <h3 className="text-lg font-semibold leading-tight text-white">{displayName}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={startNewConversation}
                  title="Clear chat history and start new conversation"
                  aria-label="Clear chat history"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={toggleOpen}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {config?.languageSelectorEnabled && (
            <div className="px-4 py-2 border-b bg-white">
              <label className="text-xs text-muted-foreground" htmlFor="chat-language">
                Language
              </label>
              <select
                id="chat-language"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                value={language || config?.defaultLanguage || "en"}
                onChange={(event) => handleLanguageChange(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div ref={scrollRef} onScroll={handleScroll} className="p-3 space-y-2 h-80 overflow-y-auto bg-slate-50">
            {loadingOlder && (
              <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin mr-1" /> Loading older messages...
              </div>
            )}
            {loadingHistory && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading conversation...
              </div>
            )}
            {messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                msg={msg}
                isAssistant={msg.role === "assistant"}
                avatarUrl={avatarUrl}
                displayName={displayName}
                onAvatarError={handleAvatarError}
                onInternalNav={handleInternalNav}
              />
            ))}
            {isSending && (
              <div className="flex gap-2 justify-start">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={handleAvatarError}
                  className="h-7 w-7 rounded-full border border-slate-200 object-cover mt-0.5"
                />
                <div className="rounded-lg px-3 py-2.5 text-sm bg-white border text-slate-800">
                  <div className="flex items-center justify-center gap-1 h-4">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
            {messages.length === 0 && !loadingHistory && (
              <p className="text-sm text-muted-foreground text-center py-8">Ask us anything about services or availability.</p>
            )}
          </div>

          <div className="border-t bg-white p-3">
            {limitReached ? (
              <Button onClick={startNewConversation} className="w-full" variant="outline">
                Start New Conversation
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isSending}
                  data-testid="input-chat-message"
                />
                <Button onClick={sendMessage} disabled={isSending || !input.trim()} size="icon" className="shrink-0">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
