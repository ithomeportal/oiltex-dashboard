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
  cma_diff_low: number | null;
  cma_diff_high: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  midland_diff_low: number | null;
  midland_diff_high: number | null;
  wti_midland_price_low: number | null;
  wti_midland_price_high: number | null;
  wti_midland_price: number | null;
  wtl_midland_low: number | null;
  wtl_midland_high: number | null;
  wtl_midland_wtd_avg: number | null;
  wtl_midland_diff_low: number | null;
  wtl_midland_diff_high: number | null;
  wtl_midland_diff: number | null;
  extraction_confidence: number | null;
}

interface RawExtraction {
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  cma_diff_low: number | null;
  cma_diff_high: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  midland_diff_low: number | null;
  midland_diff_high: number | null;
  wti_midland_price_low: number | null;
  wti_midland_price_high: number | null;
  wti_midland_price: number | null;
  wtl_midland_low: number | null;
  wtl_midland_high: number | null;
  wtl_midland_wtd_avg: number | null;
  wtl_midland_diff_low: number | null;
  wtl_midland_diff_high: number | null;
  wtl_midland_diff: number | null;
  extraction_confidence: number | null;
}

const RETRY_NYMEX_PROMPT = `You are an expert at extracting pricing data from Argus Americas Crude (ACR) PDF reports.

CRITICAL TASK: On Page 2, find the "CMA Nymex" PRICE value for the front-month contract.

IMPORTANT: On Page 2, there is a small table near the top with rows labeled "CMA Nymex" for different months (Apr, May, Jun, Jul). Each row has a "Price" column with an absolute $/bbl value (typically $50-$200). This is SEPARATE from the "WTI diff to CMA Nymex" row lower in the table which has differential values.

Look for the row: "CMA Nymex    [front month]    [Price value]"
The Price value for the FIRST/front month is what I need. It will be a number like 89.47, 82.04, 77.42, etc.

Return ONLY valid JSON: { "nymex_cma_td": <number or null> }

Return the number (no $ sign). If you truly cannot find it, return null.`;

const EXTRACTION_PROMPT = `You are an expert at extracting pricing data from Argus Americas Crude (ACR) PDF reports. Focus on Page 2 of the report.

Extract the following values from the pricing table on Page 2. The page has these sections from top to bottom:

**First: WTI Cushing rows** (absolute prices, skip these)
**Then: "CMA Nymex" rows** — a small group of rows labeled "CMA Nymex" with months (Apr, May, Jun, Jul). Each has a Price column with absolute $/bbl values.
**Then: WTI Houston, WTI Midland rows** (with Diff and Price columns)
**Then: "WTI diff to CMA Nymex" row** (with differential values, NOT absolute prices)
**Then: More crude grade rows...**
**Then: WTL Midland row**

Extract these values:

**From "CMA Nymex" rows (absolute price, NOT differential):**
1. **report_date** — The date of the report. Format: YYYY-MM-DD
2. **contract_month** — The front-month delivery/contract month. Format: YYYY-MM
3. **nymex_cma_td** — "CMA Nymex" row for the FRONT MONTH, "Price" column. This is an absolute $/bbl value (range: 50-200). NOT a differential. Look for it near the top of Page 2, ABOVE the "WTI diff to CMA Nymex" row.

**From "WTI diff to CMA Nymex" row (differentials only):**
4. **cma_diff_low** — "WTI diff to CMA Nymex" row, "Diff low" column. Typically -20 to +20.
5. **cma_diff_high** — "WTI diff to CMA Nymex" row, "Diff high" column. Typically -20 to +20.
6. **cma_diff_daily** — "WTI diff to CMA Nymex" row, "Diff weighted average" column. Typically -20 to +20.
7. **cma_diff_mtd** — "WTI diff to CMA Nymex" row, "Diff MTD weighted average" column.

**Section 2: WTI Midland (differentials + flat prices)**
8. **midland_diff_low** — "WTI Midland" row, "Diff Low" column. Typically -5 to +5.
9. **midland_diff_high** — "WTI Midland" row, "Diff High" column. Typically -5 to +5.
10. **midland_diff_daily** — "WTI Midland" row, "Diff" weighted average. Typically -5 to +5.
11. **midland_diff_mtd** — "WTI Midland" row, MTD Diff weighted average.
12. **wti_midland_price_low** — "WTI Midland" row, "Price Low" or "Low" flat price. Absolute $/bbl (50-200).
13. **wti_midland_price_high** — "WTI Midland" row, "Price High" or "High" flat price. Absolute $/bbl (50-200).
14. **wti_midland_price** — "WTI Midland" row, "Price" weighted average. Absolute $/bbl (50-200).

**Section 3: WTL Midland (differentials + flat prices)**
15. **wtl_midland_diff_low** — "WTL Midland" row, "Diff Low" column. Typically -5 to +5.
16. **wtl_midland_diff_high** — "WTL Midland" row, "Diff High" column. Typically -5 to +5.
17. **wtl_midland_diff** — "WTL Midland" row, "Diff" weighted average. Typically -5 to +5.
18. **wtl_midland_low** — "WTL Midland" row, "Price Low" flat price. Absolute $/bbl (50-200).
19. **wtl_midland_high** — "WTL Midland" row, "Price High" flat price. Absolute $/bbl (50-200).
20. **wtl_midland_wtd_avg** — "WTL Midland" row, "Price" weighted average. Absolute $/bbl (50-200).
21. **extraction_confidence** — Your confidence in the extraction accuracy (0-100).

IMPORTANT:
- All price values should be plain numbers (no $ signs, no units)
- Negative values should have a minus sign (e.g., -0.25)
- Use null for any value you cannot find
- The contract month should be the delivery month referenced in the pricing table
- "Diff" values are differentials (small numbers, can be negative). "Price" values are absolute $/bbl (large numbers, 50-200).
- WTI Midland and WTL Midland each have BOTH differential columns AND flat price columns — extract both.

Return ONLY valid JSON matching this exact structure:
{
  "report_date": "YYYY-MM-DD",
  "contract_month": "YYYY-MM",
  "nymex_cma_td": null,
  "cma_diff_low": null,
  "cma_diff_high": null,
  "cma_diff_daily": null,
  "cma_diff_mtd": null,
  "midland_diff_low": null,
  "midland_diff_high": null,
  "midland_diff_daily": null,
  "midland_diff_mtd": null,
  "wti_midland_price_low": null,
  "wti_midland_price_high": null,
  "wti_midland_price": null,
  "wtl_midland_diff_low": null,
  "wtl_midland_diff_high": null,
  "wtl_midland_diff": null,
  "wtl_midland_low": null,
  "wtl_midland_high": null,
  "wtl_midland_wtd_avg": null,
  "extraction_confidence": null
}`;

async function callExtraction(
  base64Pdf: string,
  prompt: string,
  model: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model,
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
            text: prompt,
          },
        ],
      },
    ],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return textContent.text;
}

async function retryNymexExtraction(
  base64Pdf: string
): Promise<number | null> {
  try {
    console.log("Retrying NYMEX CMA extraction with Sonnet...");
    const text = await callExtraction(
      base64Pdf,
      RETRY_NYMEX_PROMPT,
      "claude-sonnet-4-6"
    );
    const jsonStr = extractJsonFromResponse(text);
    const result = JSON.parse(jsonStr) as { nymex_cma_td: number | null };
    if (
      result.nymex_cma_td !== null &&
      result.nymex_cma_td >= 20 &&
      result.nymex_cma_td <= 200
    ) {
      console.log(`Sonnet retry found nymex_cma_td: ${result.nymex_cma_td}`);
      return result.nymex_cma_td;
    }
    return null;
  } catch (err) {
    console.warn("NYMEX retry failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function extractArgusPricingFromBuffer(
  pdfBuffer: Buffer
): Promise<ArgusPricingData> {
  const base64Pdf = pdfBuffer.toString("base64");

  // Primary extraction with Haiku
  const text = await callExtraction(
    base64Pdf,
    EXTRACTION_PROMPT,
    "claude-haiku-4-5-20251001"
  );

  const jsonStr = extractJsonFromResponse(text);
  const parsed = JSON.parse(jsonStr) as RawExtraction;

  // If nymex_cma_td is null, retry with Sonnet and a focused prompt
  if (parsed.nymex_cma_td === null) {
    console.warn("Haiku returned null for nymex_cma_td, attempting Sonnet retry...");
    const retryValue = await retryNymexExtraction(base64Pdf);
    if (retryValue !== null) {
      parsed.nymex_cma_td = retryValue;
    }
  }

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
  // Validate new Low/High diff fields (same range as their daily counterparts)
  for (const field of ["cma_diff_low", "cma_diff_high"] as const) {
    if (data[field] !== null && (data[field]! < -20 || data[field]! > 20)) {
      errors.push(`${field} out of range: ${data[field]}`);
    }
  }
  for (const field of ["midland_diff_low", "midland_diff_high", "wtl_midland_diff_low", "wtl_midland_diff_high", "wtl_midland_diff"] as const) {
    if (data[field] !== null && (data[field]! < -20 || data[field]! > 20)) {
      errors.push(`${field} out of range: ${data[field]}`);
    }
  }
  // Validate flat prices (absolute $/bbl)
  for (const field of ["wtl_midland_low", "wtl_midland_high", "wtl_midland_wtd_avg", "wti_midland_price_low", "wti_midland_price_high", "wti_midland_price"] as const) {
    if (data[field] !== null && (data[field]! < 20 || data[field]! > 200)) {
      errors.push(`${field} out of range: ${data[field]}`);
    }
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
