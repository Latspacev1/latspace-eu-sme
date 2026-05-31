// Reads an NDJSON streaming response and dispatches each line as soon as it
// arrives. The agent dispatcher and the extract/chat/write routes emit one JSON
// object per line ({ event, data }), so each onEvent callback fires
// progressively rather than all at once at the end.
//
// Shared by components/reporting/qualitative/AssistantPane.tsx (chat/write) and
// lib/api/extract.ts (document extraction).

export async function readNdjson(
  res: Response,
  onEvent: (ev: { event: string; data: unknown }) => void,
): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line));
        } catch {
          // Skip malformed lines rather than aborting the whole stream.
        }
      }
      nl = buffer.indexOf("\n");
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail));
    } catch {}
  }
}
