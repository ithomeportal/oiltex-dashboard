import Anthropic from "@anthropic-ai/sdk";
import type { TicketExtractedData } from "./ticket-types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXTRACTION_PROMPT = `You are an expert oil field ticket data extractor. Extract ALL data from this oil transport/run ticket PDF into the exact JSON structure below.

IMPORTANT RULES:
- Extract every visible field from the ticket
- Use null for any field not found on the ticket
- Numbers must be plain numbers (no units, no commas)
- Dates should be in YYYY-MM-DD format
- Times should be in HH:MM format (24hr or as shown)
- GPS coordinates: decimal degrees (e.g., 32.7157, -103.1891)
- BS&W is a percentage (e.g., 0.25 means 0.25%)
- Barrels: use exact decimal values shown on ticket
- Confidence: 0-100 score of how confident you are in the overall extraction

Return ONLY valid JSON matching this exact structure:
{
  "bol_number": "string or null",
  "ticket_number": "string or null",
  "ticket_date": "YYYY-MM-DD or null",
  "trucking_company": "string or null",
  "shipper": {
    "name": "well/lease name or null",
    "time": "HH:MM or null",
    "account": "string or null",
    "city": "string or null",
    "county": "string or null",
    "state": "2-letter code or null",
    "lat": null,
    "lon": null
  },
  "operator": "string or null",
  "property_number": "string or null",
  "legal_land_desc": "string or null",
  "federal_lease_number": "string or null",
  "receiver": {
    "name": "pipeline/storage name or null",
    "time": "HH:MM or null",
    "account": "string or null",
    "city": "string or null",
    "county": "string or null",
    "state": "2-letter code or null",
    "lat": null,
    "lon": null
  },
  "tank_id": "string or null",
  "tank_bbls_per_inch": null,
  "tank_height": null,
  "tank_volume": null,
  "header_number": "string or null",
  "start_meter_1": null,
  "stop_meter_1": null,
  "start_meter_2": null,
  "stop_meter_2": null,
  "seal_off": "string or null",
  "seal_on": "string or null",
  "time_off": "HH:MM or null",
  "time_on": "HH:MM or null",
  "obs_gravity": null,
  "obs_temp": null,
  "start_temp": null,
  "stop_temp": null,
  "bsw_percent": null,
  "avg_line_temp": null,
  "meter_factor": null,
  "loaded_barrels": null,
  "net_barrels": null,
  "delivered_bbls": null,
  "corrected_gravity": null,
  "driver_name": "string or null",
  "truck_number": "string or null",
  "trailer_number": "string or null",
  "standard_distance": null,
  "loaded_miles": null,
  "rerouted_miles": null,
  "road_restrictions": "string or null",
  "notes": "string or null",
  "driver_notes": "string or null",
  "po_number": "string or null",
  "extraction_confidence": null
}`;

// Extract ticket data from a PDF URL
export async function extractTicketFromPdfUrl(pdfUrl: string): Promise<TicketExtractedData> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }

  const pdfBuffer = await response.arrayBuffer();
  return extractTicketFromBuffer(Buffer.from(pdfBuffer));
}

// Extract ticket data from a local file buffer
export async function extractTicketFromBuffer(pdfBuffer: Buffer): Promise<TicketExtractedData> {
  const base64Pdf = pdfBuffer.toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
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
  const parsed = JSON.parse(jsonStr) as TicketExtractedData;

  const errors = validateExtractedData(parsed);
  if (errors.length > 0) {
    console.warn("Extraction validation warnings:", errors);
  }

  return parsed;
}

// Extract JSON from Claude response (handles markdown code blocks)
function extractJsonFromResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  throw new Error("No JSON found in Claude response");
}

// Validate extracted data ranges
export function validateExtractedData(data: TicketExtractedData): string[] {
  const errors: string[] = [];

  if (data.loaded_barrels !== null && (data.loaded_barrels < 0 || data.loaded_barrels > 500)) {
    errors.push(`Loaded barrels out of range: ${data.loaded_barrels}`);
  }
  if (data.net_barrels !== null && (data.net_barrels < 0 || data.net_barrels > 500)) {
    errors.push(`Net barrels out of range: ${data.net_barrels}`);
  }
  if (data.delivered_bbls !== null && (data.delivered_bbls < 0 || data.delivered_bbls > 500)) {
    errors.push(`Delivered BBLs out of range: ${data.delivered_bbls}`);
  }
  if (data.obs_gravity !== null && (data.obs_gravity < 10 || data.obs_gravity > 70)) {
    errors.push(`Observed gravity out of range: ${data.obs_gravity}`);
  }
  if (data.obs_temp !== null && (data.obs_temp < -50 || data.obs_temp > 200)) {
    errors.push(`Observed temperature out of range: ${data.obs_temp}`);
  }
  if (data.bsw_percent !== null && (data.bsw_percent < 0 || data.bsw_percent > 100)) {
    errors.push(`BS&W percent out of range: ${data.bsw_percent}`);
  }
  if (data.shipper?.lat !== null && data.shipper?.lat !== undefined) {
    if (data.shipper.lat < 25 || data.shipper.lat > 50) {
      errors.push(`Shipper latitude out of US bounds: ${data.shipper.lat}`);
    }
  }
  if (data.shipper?.lon !== null && data.shipper?.lon !== undefined) {
    if (data.shipper.lon < -130 || data.shipper.lon > -60) {
      errors.push(`Shipper longitude out of US bounds: ${data.shipper.lon}`);
    }
  }

  return errors;
}

// Flatten nested extracted data into top-level DB columns
export function flattenExtractedData(
  data: TicketExtractedData,
  uploadId: number | null
): Record<string, unknown> {
  return {
    upload_id: uploadId,
    bol_number: data.bol_number,
    ticket_number: data.ticket_number,
    ticket_date: data.ticket_date,
    trucking_company: data.trucking_company,
    shipper_name: data.shipper?.name ?? null,
    shipper_time: data.shipper?.time ?? null,
    shipper_account: data.shipper?.account ?? null,
    operator: data.operator,
    property_number: data.property_number,
    legal_land_desc: data.legal_land_desc,
    federal_lease_number: data.federal_lease_number,
    shipper_city: data.shipper?.city ?? null,
    shipper_county: data.shipper?.county ?? null,
    shipper_state: data.shipper?.state ?? null,
    shipper_lat: data.shipper?.lat ?? null,
    shipper_lon: data.shipper?.lon ?? null,
    receiver_name: data.receiver?.name ?? null,
    receiver_time: data.receiver?.time ?? null,
    receiver_account: data.receiver?.account ?? null,
    receiver_city: data.receiver?.city ?? null,
    receiver_county: data.receiver?.county ?? null,
    receiver_state: data.receiver?.state ?? null,
    receiver_lat: data.receiver?.lat ?? null,
    receiver_lon: data.receiver?.lon ?? null,
    tank_id: data.tank_id,
    tank_bbls_per_inch: data.tank_bbls_per_inch,
    tank_height: data.tank_height,
    tank_volume: data.tank_volume,
    header_number: data.header_number,
    start_meter_1: data.start_meter_1,
    stop_meter_1: data.stop_meter_1,
    start_meter_2: data.start_meter_2,
    stop_meter_2: data.stop_meter_2,
    seal_off: data.seal_off,
    seal_on: data.seal_on,
    time_off: data.time_off,
    time_on: data.time_on,
    obs_gravity: data.obs_gravity,
    obs_temp: data.obs_temp,
    start_temp: data.start_temp,
    stop_temp: data.stop_temp,
    bsw_percent: data.bsw_percent,
    avg_line_temp: data.avg_line_temp,
    meter_factor: data.meter_factor,
    loaded_barrels: data.loaded_barrels,
    net_barrels: data.net_barrels,
    delivered_bbls: data.delivered_bbls,
    corrected_gravity: data.corrected_gravity,
    driver_name: data.driver_name,
    truck_number: data.truck_number,
    trailer_number: data.trailer_number,
    standard_distance: data.standard_distance,
    loaded_miles: data.loaded_miles,
    rerouted_miles: data.rerouted_miles,
    road_restrictions: data.road_restrictions,
    notes: data.notes,
    driver_notes: data.driver_notes,
    po_number: data.po_number,
    extraction_confidence: data.extraction_confidence,
    manually_corrected: false,
  };
}
