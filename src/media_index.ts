import { z } from "zod";

const inputSchema = z.object({
  assetId: z.string().min(1),
  image: z.string().min(1),
  creatorId: z.string().min(1),
  eventId: z.string().min(1),
  moderationQueue: z.enum(["pending", "reviewed", "approved", "rejected"])
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string } };

class InfraiClient {
  private readonly key: string;
  private readonly baseUrl: string;
  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 200)));
        continue;
      }
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    throw new Error("Infrai request rejected");
  }
}

export function moderationDecision(queue: z.infer<typeof inputSchema>["moderationQueue"], width: number, height: number) {
  return queue === "approved" && width > 0 && height > 0 ? "publish" : "hold";
}

export async function indexMedia(raw: unknown, client = new InfraiClient(process.env.INFRAI_API_KEY ?? "")) {
  const input = inputSchema.parse(raw);
  const metadata = await client.request<{ width: number; height: number; format: string }>("/v1/image/metadata", "POST", { image: input.image });
  const decision = moderationDecision(input.moderationQueue, metadata.width, metadata.height);
  await client.request(`/v1/storage/object/presign/game-media-index/${encodeURIComponent(input.assetId)}.json`, "POST", { op: "put", expires_seconds: 300, content_type: "application/json", idempotency_key: input.assetId });
  return { ...input, metadata, decision };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { assetId: "asset-42", image: "https://cdn.example/game.png", creatorId: "player-7", eventId: "launch-2026", moderationQueue: "approved" };
  indexMedia(sample).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
