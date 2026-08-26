const SCREENSHOT_API = "https://api.screenshotone.com/take";

const DESIGN_PROMPT =
  "Describe this webpage's visual design in detail for a designer to replicate it: " +
  "color palette (specific hex values when visible), typography (font styles and sizes), " +
  "layout structure, spacing, UI components, and overall aesthetic. Focus on design " +
  "decisions, not page content. Be specific and concise.";

const VISION_TIMEOUT_MS = 30_000;

/** Take a screenshot of a URL via ScreenshotOne. Null when unconfigured/failed. */
export async function screenshotUrl(url: string): Promise<Buffer | null> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) return null;

  const apiUrl =
    `${SCREENSHOT_API}?url=${encodeURIComponent(url)}` +
    `&access_key=${accessKey}&viewport_width=1280&viewport_height=800&format=png`;

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Describe the visual design of a screenshot via vision model. */
export async function describeVisual(buffer: Buffer): Promise<string | null> {
  try {
    const { resolveModel } = await import("../model-runtime.js");
    const { runtime: rt, model } = await resolveModel("vision");

    const stream = rt.stream(model, {
      messages: [
        {
          role: "user",
          timestamp: Date.now(),
          content: [
            { type: "text", text: DESIGN_PROMPT },
            { type: "image", data: buffer.toString("base64"), mimeType: "image/png" },
          ],
        },
      ],
    });

    const assistant = await Promise.race([
      stream.result(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("vision timed out")), VISION_TIMEOUT_MS),
      ),
    ]);
    if (assistant === null) return null;
    if (assistant.stopReason === "error") return null;
    const text = (assistant?.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

/** Screenshot + vision description. Null if either step fails. */
export async function captureVisualStyle(url: string): Promise<string | null> {
  const buffer = await screenshotUrl(url);
  if (!buffer) return null;
  return describeVisual(buffer);
}
