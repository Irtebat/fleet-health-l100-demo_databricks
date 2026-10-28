import type { Application } from 'express';
import { z } from 'zod';
import { safely } from '../http';

// The fleet agent is a MLflow ResponsesAgent: it takes { input: [...] } and returns
// { output: [{ type: "message", content: [{ type: "output_text", text }] }] }.
// The serving plugin calls it as the app's service principal (CAN_QUERY on the endpoint).

// AppKit's serving plugin wraps every call: { ok: true, data } or { ok: false, status, message }.
type InvokeResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

export interface AgentEndpoint {
  invoke(body: Record<string, unknown>): Promise<unknown>;
}

const ChatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20)
    .refine((messages) => messages[messages.length - 1]?.role === 'user', {
      message: 'The last message must be from the user',
    }),
});

const AgentReply = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
});

// Pulls the answer text out of the agent's response; null if the shape is unexpected.
export function answerText(raw: unknown): string | null {
  const reply = AgentReply.safeParse(raw);
  if (!reply.success) return null;
  const texts = reply.data.output
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text' && part.text)
    .map((part) => part.text ?? '');
  return texts.length > 0 ? texts.join('\n\n') : null;
}

export function registerAssistantRoutes(app: Application, agent: AgentEndpoint) {
  app.post(
    '/api/assistant',
    safely('The assistant is unavailable right now', async (req, res) => {
      const body = ChatBody.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({ error: body.error.issues[0]?.message ?? 'Invalid message' });
        return;
      }
      const result = (await agent.invoke({ input: body.data.messages })) as InvokeResult;
      if (!result.ok) {
        console.error('[assistant] agent call failed:', result.status, result.message);
        res.status(502).json({ error: 'The assistant is unavailable right now' });
        return;
      }
      const answer = answerText(result.data);
      if (!answer) {
        console.error('[assistant] unexpected agent response:', JSON.stringify(result.data).slice(0, 500));
        res.status(502).json({ error: 'The assistant returned an unexpected response' });
        return;
      }
      res.json({ answer });
    }),
  );
}
