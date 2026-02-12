// Upload status union
export type UploadStatus = "pending" | "processing" | "completed" | "failed";

// Matches oil_ticket_uploads table
export interface OilTicketUpload {
  readonly id: number;
  readonly filename: string;
  readonly file_url: string;
  readonly file_key: string;
  readonly file_size: number;
  readonly upload_date: string;
  readonly status: UploadStatus;
  readonly processed_at: string | null;
  readonly error_message: string | null;
  readonly uploaded_by: string;
}

// Shipper/Receiver location nested structure from extraction
export interface TicketLocation {
  readonly name: string | null;
  readonly time: string | null;
  readonly account: string | null;
  readonly city: string | null;
  readonly county: string | null;
  readonly state: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
}

// Claude extraction result (nested locations)
export interface TicketExtractedData {
  readonly bol_number: string | null;
  readonly ticket_number: string | null;
  readonly ticket_date: string | null;
  readonly trucking_company: string | null;
  readonly shipper: TicketLocation;
  readonly operator: string | null;
  readonly property_number: string | null;
  readonly legal_land_desc: string | null;
  readonly federal_lease_number: string | null;
  readonly receiver: TicketLocation;
  readonly tank_id: string | null;
  readonly tank_bbls_per_inch: number | null;
  readonly tank_height: number | null;
  readonly tank_volume: number | null;
  readonly header_number: string | null;
  readonly start_meter_1: number | null;
  readonly stop_meter_1: number | null;
  readonly start_meter_2: number | null;
  readonly stop_meter_2: number | null;
  readonly seal_off: string | null;
  readonly seal_on: string | null;
  readonly time_off: string | null;
  readonly time_on: string | null;
  readonly obs_gravity: number | null;
  readonly obs_temp: number | null;
  readonly start_temp: number | null;
  readonly stop_temp: number | null;
  readonly bsw_percent: number | null;
  readonly avg_line_temp: number | null;
  readonly meter_factor: number | null;
  readonly loaded_barrels: number | null;
  readonly net_barrels: number | null;
  readonly delivered_bbls: number | null;
  readonly corrected_gravity: number | null;
  readonly driver_name: string | null;
  readonly truck_number: string | null;
  readonly trailer_number: string | null;
  readonly standard_distance: number | null;
  readonly loaded_miles: number | null;
  readonly rerouted_miles: number | null;
  readonly road_restrictions: string | null;
  readonly notes: string | null;
  readonly driver_notes: string | null;
  readonly po_number: string | null;
  readonly extraction_confidence: number | null;
}

// Matches oil_tickets table (flattened locations)
export interface OilTicket {
  readonly id: number;
  readonly upload_id: number | null;
  readonly bol_number: string | null;
  readonly ticket_number: string | null;
  readonly trucking_company: string | null;
  readonly shipper_name: string | null;
  readonly shipper_time: string | null;
  readonly shipper_account: string | null;
  readonly operator: string | null;
  readonly property_number: string | null;
  readonly legal_land_desc: string | null;
  readonly federal_lease_number: string | null;
  readonly shipper_city: string | null;
  readonly shipper_county: string | null;
  readonly shipper_state: string | null;
  readonly shipper_lat: number | null;
  readonly shipper_lon: number | null;
  readonly receiver_name: string | null;
  readonly receiver_time: string | null;
  readonly receiver_account: string | null;
  readonly receiver_city: string | null;
  readonly receiver_county: string | null;
  readonly receiver_state: string | null;
  readonly receiver_lat: number | null;
  readonly receiver_lon: number | null;
  readonly tank_id: string | null;
  readonly tank_bbls_per_inch: number | null;
  readonly tank_height: number | null;
  readonly tank_volume: number | null;
  readonly header_number: string | null;
  readonly start_meter_1: number | null;
  readonly stop_meter_1: number | null;
  readonly start_meter_2: number | null;
  readonly stop_meter_2: number | null;
  readonly seal_off: string | null;
  readonly seal_on: string | null;
  readonly time_off: string | null;
  readonly time_on: string | null;
  readonly obs_gravity: number | null;
  readonly obs_temp: number | null;
  readonly start_temp: number | null;
  readonly stop_temp: number | null;
  readonly bsw_percent: number | null;
  readonly avg_line_temp: number | null;
  readonly meter_factor: number | null;
  readonly loaded_barrels: number | null;
  readonly net_barrels: number | null;
  readonly delivered_bbls: number | null;
  readonly corrected_gravity: number | null;
  readonly driver_name: string | null;
  readonly truck_number: string | null;
  readonly trailer_number: string | null;
  readonly standard_distance: number | null;
  readonly loaded_miles: number | null;
  readonly rerouted_miles: number | null;
  readonly road_restrictions: string | null;
  readonly notes: string | null;
  readonly driver_notes: string | null;
  readonly po_number: string | null;
  readonly extraction_confidence: number | null;
  readonly manually_corrected: boolean;
  readonly ticket_date: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

// Query filter params
export interface TicketFilters {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly shipper?: string;
  readonly operator?: string;
  readonly county?: string;
  readonly state?: string;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
}

// Monthly aggregation shape
export interface TicketSummary {
  readonly month: string;
  readonly total_tickets: number;
  readonly total_loaded_bbls: number;
  readonly total_net_bbls: number;
  readonly total_delivered_bbls: number;
  readonly avg_gravity: number | null;
  readonly avg_bsw: number | null;
  readonly wells: ReadonlyArray<WellBreakdown>;
}

export interface WellBreakdown {
  readonly shipper_name: string;
  readonly operator: string | null;
  readonly county: string | null;
  readonly state: string | null;
  readonly ticket_count: number;
  readonly loaded_bbls: number;
  readonly net_bbls: number;
  readonly delivered_bbls: number;
}
