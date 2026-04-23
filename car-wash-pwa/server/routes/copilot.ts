/**
 * Jadawel Copilot — AI agent with function calling.
 *
 * Scope: vendor_admin / admin only. The agent reads and writes within
 * the vendor's tenant, never across tenants. Writes return a preview
 * payload on the first call and only mutate when `_confirm: true` is
 * included — the UI renders a confirmation dialog between the two.
 */

import { Router } from 'express';
import OpenAI from 'openai';
import { z } from 'zod';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { COPILOT_TOOLS, executeCopilotTool, CopilotContext } from '../services/copilot/tools.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'tool']),
    content: z.string(),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
  })).min(1),
});

const SYSTEM_PROMPT = `أنت "جدول" — المساعد الذكي لمنصة جداول السعودية لإدارة الحجوزات.

مهمتك: تساعد التاجر يفهم بياناته ويعدّل على متجره بسرعة وبدون ما يتنقّل بين الصفحات.

قواعد مهمة:
- أجب باللهجة السعودية، قصير ومباشر، بدون تنميق زائد.
- استخدم الأدوات المتاحة لقراءة البيانات — لا تخترع أرقام أبداً.
- إذا طلب التاجر إنشاء/تعديل شي، نفّذ الأداة المناسبة. أول استدعاء يرجع Preview — اسأل التاجر "تبي أكمّل؟" ولا تستدعي الأداة مرة ثانية مع _confirm: true إلا بعد موافقته الصريحة.
- لو سألك سؤال عام ما يحتاج أداة، جاوب مباشرة وبدون استدعاء.
- إذا ما قدرت تجاوب بثقة، قل "ما قدرت ألقى معلومة أكيدة — تحقق من [الصفحة المناسبة]".`;

router.post('/chat', async (req: AuthRequest, res) => {
  try {
    const data = chatSchema.parse(req.body);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير مفعّلة على السيرفر' });

    const ctx: CopilotContext = {
      vendorId,
      userId: req.user!.id,
      role: req.user!.role,
      ip: req.ip ?? req.socket.remoteAddress ?? undefined,
      // Per-turn write budget: prevents an LLM loop from creating 1000
      // services in one conversation. Reset on every /chat request.
      writesUsed: { count: 0 },
    };

    const openai = new OpenAI({ apiKey });
    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...data.messages.map((m) => ({
        role: m.role as any,
        content: m.content,
      } as OpenAI.Chat.ChatCompletionMessageParam)),
    ];

    const trace: Array<{ tool: string; args: unknown; result: unknown }> = [];

    // Function-calling loop — capped at 6 iterations.
    for (let step = 0; step < 6; step++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        tools: COPILOT_TOOLS as any,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 800,
      });
      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Add the assistant turn with its tool calls so the loop is consistent.
        conversation.push(msg as OpenAI.Chat.ChatCompletionMessageParam);
        for (const call of msg.tool_calls) {
          // Current openai types allow both function and custom tool-calls;
          // we only register function tools, so narrow defensively.
          if ((call as any).type && (call as any).type !== 'function') continue;
          const fn = (call as any).function as { name: string; arguments: string } | undefined;
          if (!fn) continue;
          const fnName = fn.name;
          let args: Record<string, any> = {};
          try { args = JSON.parse(fn.arguments || '{}'); } catch { args = {}; }
          let result;
          try {
            result = await executeCopilotTool(ctx, fnName, args);
          } catch (err) {
            result = { summary: `فشل التنفيذ: ${(err as Error).message}` };
          }
          trace.push({ tool: fnName, args, result });
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          } as OpenAI.Chat.ChatCompletionMessageParam);
        }
        continue;
      }

      // No more tool calls — this is the final assistant message.
      return res.json({
        reply: msg.content ?? '',
        trace,
      });
    }

    return res.json({
      reply: 'وصلت للحد الأقصى من الخطوات بدون إجابة نهائية. جرّب صياغة ثانية.',
      trace,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[copilot/chat]', e);
    return res.status(500).json({ error: 'خطأ في الذكاء الاصطناعي' });
  }
});

export default router;
