import { LoaderCircle, MessageSquare, Send, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../../../shared/types';
import { Alert, EmptyState, PageHeader, Panel, Skeleton } from '../components/kit';
import { api, errorMessage } from '../lib/api';
import { buttonPrimary, buttonSecondary, cx } from '../lib/ui';

const PROMPTS = [
  'Which machines in the West region need attention?',
  'What is the status of EX-007?',
  'Which machines have the most faults?',
];

// Markdown styling for agent answers (lists, tables, bold), without a typography plugin.
const ANSWER_STYLE =
  'rounded-lg border border-border px-4 py-3 text-sm leading-relaxed ' +
  '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold ' +
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
  '[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border-b [&_th]:border-border [&_th]:py-1 ' +
  '[&_th]:text-left [&_td]:border-b [&_td]:border-border [&_td]:py-1';

export function AssistantPage() {
  // The conversation lives in the browser: every request sends the full history.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `history` always ends with the user's latest message. If the call fails, it stays
  // in the conversation so "Try again" can resend it.
  async function ask(history: ChatMessage[]) {
    setMessages(history);
    setPending(true);
    setError(null);
    try {
      const { answer } = await api.ask(history);
      setMessages([...history, { role: 'assistant', content: answer }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setInput('');
    void ask([...messages, { role: 'user', content: question }]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter adds a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  }

  function clear() {
    setMessages([]);
    setError(null);
  }

  return (
    <>
      <PageHeader
        title="Assistant"
        description="Ask about the fleet in plain language. The fleet agent reads the same machine data as the Fleet page."
        actions={
          messages.length > 0 && (
            <button type="button" onClick={clear} disabled={pending} className={buttonSecondary}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear conversation
            </button>
          )
        }
      />

      <Panel className="flex min-h-[28rem] flex-col gap-4">
        {messages.length === 0 && !pending && (
          <EmptyState icon={MessageSquare} title="Ask a question to get started.">
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className={cx(buttonSecondary, 'h-auto py-1.5 text-left text-sm')}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </EmptyState>
        )}

        {messages.map((message, index) => {
          return (
            // The list only grows, so the position is a stable key here.
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className={cx('max-w-[85%]', message.role === 'user' && 'ml-auto')}>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {message.role === 'user' ? 'You' : 'Fleet agent'}
              </div>
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
                  {message.content}
                </div>
              ) : (
                <div className={ANSWER_STYLE}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {pending && (
          <div className="max-w-[85%] space-y-2" role="status" aria-live="polite">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Thinking. Answers usually take 10 to 40 seconds.
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        )}

        {error && (
          <Alert
            message={`${error}. Your question is still here, so you can try again.`}
            onRetry={() => void ask(messages)}
          />
        )}
      </Panel>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          rows={2}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          aria-label="Your question"
          placeholder="Ask about a machine, a region or a model"
          className="min-h-10 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        <button type="submit" disabled={pending || !input.trim()} className={buttonPrimary}>
          <Send className="h-4 w-4" aria-hidden />
          Send
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        AI-generated answers can be wrong. Check the Fleet page before acting on them.
      </p>
    </>
  );
}
