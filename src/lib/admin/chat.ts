// Read stored chat transcripts defensively (the shape is written by the storefront assistant).
export type ChatLine = { role: 'user' | 'assistant' | 'system'; text: string; at?: string };

export function parseChat(raw: string | null | undefined): ChatLine[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((m: Record<string, unknown>) => {
        const role = m.role === 'user' || m.role === 'me' ? 'user' : m.role === 'system' ? 'system' : 'assistant';
        const text = typeof m.text === 'string' ? m.text : typeof m.content === 'string' ? m.content : '';
        const at = typeof m.at === 'string' ? m.at : typeof m.at === 'number' ? new Date(m.at).toISOString() : undefined;
        return { role, text, at } as ChatLine;
      })
      .filter((m) => m.text);
  } catch {
    return [];
  }
}
