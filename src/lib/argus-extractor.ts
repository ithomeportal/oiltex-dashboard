import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ArgusPricingData {
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  extraction_confidence: number | null;
}

interface RawExtraction {
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  extraction_confidence: number | null;
}

const EXTRACTION_PROMPT = `You are an expert at extracting pricing data from Argus Americas Crude (ACR) PDF reports. Focus on Page 2 of the report.

Extract the following values from the pricing table on Page 2:

1. **Report Date** — The date of the report (shown at the top of the document). Format: YYYY-MM-DD
2. **Contract Month** — The current delivery/contract month being priced. Format: YYYY-MM (e.g., "2026-03")
3. **NYMEX CMA TD** — The "CMA Nymex" or "CMA to-date" value. This is the running average of NYMEX WTI settlements for the delivery month. Look in the row labeled "CMA Nymex" or similar. This is typically in the range 20-200 $/bbl.
4. **CMA Diff Daily** — The daily WTI diff to CMA Nymex value. Look for the "WTI diff to CMA Nymex" row, daily column. Can be negative or positive, typically -20 to +20.
5. **CMA Diff MTD** — The month-to-date weighted average of the WTI diff to CMA Nymex. Same row as above, MTD/weighted avg column.
6. **Midland Diff Daily** — The daily WTL Midland vs WTI Cushing differential. Look for "WTL Midland" or "Midland" row, daily column. Typically -5 to +5.
7. **Midland Diff MTD** — The month-to-date weighted average of the Midland differential. Same row, MTD/weighted avg column.
8. **Extraction Confidence** — Your confidence in the extraction accuracy (0-100).

IMPORTANT:
- All price values should be plain numbers (no $ signs, no units)
- Negative values should have a minus sign (e.g., -0.25)
- Use null for any value you cannot find
- The contract month should be the delivery month referenced in the pricing table
- Look specifically at the table with WTI-related differentials on Page 2

Return ONLY valid JSON matching this exact structure:
{
  "report_date": "YYYY-MM-DD",
  "contract_month": "YYYY-MM",
  "nymex_cma_td": null,
  "cma_diff_daily": null,
  "cma_diff_mtd": null,
  "midland_diff_daily": null,
  "midland_diff_mtd": null,
  "extraction_confidence": null
}`;

export async function extractArgusPricingFromBuffer(
  pdfBuffer: Buffer
): Promise<ArgusPricingData> {
  const base64Pdf = pdfBuffer.toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const jsonStr = extractJsonFromResponse(textContent.text);
  const parsed = JSON.parse(jsonStr) as RawExtraction;

  const errors = validateExtractedPricing(parsed);
  if (errors.length > 0) {
    console.warn("Argus pricing extraction warnings:", errors);
  }

  return parsed;
}

export async function extractArgusPricingFromUrl(
  url: string
): Promise<ArgusPricingData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch PDF: ${response.status} ${response.statusText}`
    );
  }

  const pdfBuffer = await response.arrayBuffer();
  return extractArgusPricingFromBuffer(Buffer.from(pdfBuffer));
}

function extractJsonFromResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  throw new Error("No JSON found in Claude response");
}

function validateExtractedPricing(data: RawExtraction): string[] {
  const errors: string[] = [];

  if (
    data.nymex_cma_td !== null &&
    (data.nymex_cma_td < 20 || data.nymex_cma_td > 200)
  ) {
    errors.push(`NYMEX CMA TD out of range: ${data.nymex_cma_td}`);
  }
  if (
    data.cma_diff_daily !== null &&
    (data.cma_diff_daily < -20 || data.cma_diff_daily > 20)
  ) {
    errors.push(`CMA Diff Daily out of range: ${data.cma_diff_daily}`);
  }
  if (
    data.cma_diff_mtd !== null &&
    (data.cma_diff_mtd < -20 || data.cma_diff_mtd > 20)
  ) {
    errors.push(`CMA Diff MTD out of range: ${data.cma_diff_mtd}`);
  }
  if (
    data.midland_diff_daily !== null &&
    (data.midland_diff_daily < -20 || data.midland_diff_daily > 20)
  ) {
    errors.push(`Midland Diff Daily out of range: ${data.midland_diff_daily}`);
  }
  if (
    data.midland_diff_mtd !== null &&
    (data.midland_diff_mtd < -20 || data.midland_diff_mtd > 20)
  ) {
    errors.push(`Midland Diff MTD out of range: ${data.midland_diff_mtd}`);
  }
  if (!data.report_date || !/^\d{4}-\d{2}-\d{2}$/.test(data.report_date)) {
    errors.push(`Invalid report_date format: ${data.report_date}`);
  }
  if (
    !data.contract_month ||
    !/^\d{4}-\d{2}$/.test(data.contract_month)
  ) {
    errors.push(`Invalid contract_month format: ${data.contract_month}`);
  }

  return errors;
}
