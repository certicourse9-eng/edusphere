'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ChatWidget.module.css';
import type { ChatContext } from '@/lib/chatContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  "Explain this student's score",
  'Why did the student lose marks?',
  "What are the class's weakest topics?",
  "Summarize this class's performance",
  'Explain this IB criterion',
  'How should I give feedback to this student?'
];

const WELCOME_MESSAGE = "Hi! I'm your IB Teaching Assistant 👋 How can I help you today?";

interface ChatWidgetProps {
  context: ChatContext;
  focusedStudentLabel: string | null;
}

export default function ChatWidget({ context, focusedStudentLabel }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef(context);
  contextRef.current = context;
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nextMessages: ChatMessage[] = [...messagesRef.current, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, context: contextRef.current })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Chat failed (status ${resp.status})`);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply as string }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!loading) send(input);
    },
    [send, input, loading]
  );

  const handleCopy = useCallback((i: number, content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopiedIndex(i);
        setTimeout(() => setCopiedIndex(prev => (prev === i ? null : prev)), 1500);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <button
        type="button"
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close IB Teaching Assistant' : 'Open IB Teaching Assistant'}
      >
        <span aria-hidden="true">{open ? '✕' : '💬'}</span>
      </button>

      {open && (
        <div className={`${styles.panel} fade-in`} role="dialog" aria-label="IB Teaching Assistant chat">
          <div className={styles.header}>
            <div className={styles.headerText}>
              <p className={styles.headerTitle}>IB Teaching Assistant</p>
              <p className={styles.headerSubtitle}>
                {focusedStudentLabel ? `Viewing: ${focusedStudentLabel}` : 'Ask about grading, IB criteria, or this class'}
              </p>
            </div>
            <button type="button" className={styles.minimizeBtn} onClick={() => setOpen(false)} aria-label="Minimize chat">
              –
            </button>
          </div>

          <div className={styles.body} ref={bodyRef}>
            <div className={styles.welcomeBlock}>
              <p className={styles.welcomeMsg}>{WELCOME_MESSAGE}</p>
              {messages.length === 0 && (
                <div className={styles.suggestions}>
                  {SUGGESTED_PROMPTS.map(p => (
                    <button key={p} type="button" className={styles.suggestionChip} onClick={() => send(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`${styles.messageRow} ${m.role === 'user' ? styles.fromUser : styles.fromAssistant}`}>
                <div className={styles.bubble}>
                  <p className={styles.bubbleText}>{m.content}</p>
                  {m.role === 'assistant' && (
                    <button type="button" className={styles.copyBtn} onClick={() => handleCopy(i, m.content)}>
                      {copiedIndex === i ? 'Copied ✓' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`${styles.messageRow} ${styles.fromAssistant}`}>
                <div className={`${styles.bubble} ${styles.typingBubble}`}>
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}

            {error && <p className={styles.errorNote}>{error}</p>}
          </div>

          <form className={styles.inputRow} onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about grading, IB criteria, this class…"
              className={styles.input}
              disabled={loading}
              aria-label="Message the IB Teaching Assistant"
            />
            <button type="submit" className={styles.sendBtn} disabled={loading || !input.trim()} aria-label="Send message">
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
