import { badRequest } from "./errors";
import { parseReceiptText } from "./receipt-parser";

export type VisionReceiptResult = ReturnType<typeof parseReceiptText>;

export async function scanReceiptWithVision(input: { buffer: Buffer; mimeType: string }): Promise<VisionReceiptResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();
  if (!apiKey) badRequest("Receipt scanning is not configured");

  const base64 = input.buffer.toString("base64");
  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: {
            languageHints: ["en", "es", "it", "nl", "de", "fr", "pt"],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Google Vision request failed");
  }

  const body = await response.json() as {
    responses?: Array<{
      error?: { message?: string };
      fullTextAnnotation?: { text?: string };
      textAnnotations?: Array<{ description?: string }>;
    }>;
  };

  const result = body.responses?.[0];
  if (result?.error?.message) {
    throw new Error(result.error.message);
  }

  const rawText = result?.fullTextAnnotation?.text?.trim()
    || result?.textAnnotations?.[0]?.description?.trim()
    || "";
  const parsed = parseReceiptText(rawText);
  if (process.env.NODE_ENV !== "production") {
    console.info("[receipt-scan] parsed receipt", {
      rawText,
      parsed,
    });
  }
  return parsed;
}
