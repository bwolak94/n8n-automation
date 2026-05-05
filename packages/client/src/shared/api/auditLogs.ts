import { apiClient } from "./client.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:         string;
  tenantId:   string;
  actorId:    string;
  actorEmail?: string;
  ipAddress?:  string;
  userAgent?:  string;
  eventType:  string;
  entityType?: string;
  entityId?:   string;
  metadata?:   Record<string, unknown>;
  createdAt:  string;
}

export interface AuditLogQuery {
  eventType?:  string;
  actorId?:    string;
  entityType?: string;
  entityId?:   string;
  from?:       string;
  to?:         string;
  limit?:      number;
  offset?:     number;
}

export interface AuditLogPage {
  items:  AuditLog[];
  total:  number;
  limit:  number;
  offset: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function listAuditLogs(query: AuditLogQuery = {}): Promise<AuditLogPage> {
  const params = new URLSearchParams();
  if (query.eventType)             params.set("eventType",  query.eventType);
  if (query.actorId)               params.set("actorId",    query.actorId);
  if (query.entityType)            params.set("entityType", query.entityType);
  if (query.entityId)              params.set("entityId",   query.entityId);
  if (query.from)                  params.set("from",       query.from);
  if (query.to)                    params.set("to",         query.to);
  if (query.limit !== undefined)   params.set("limit",      String(query.limit));
  if (query.offset !== undefined)  params.set("offset",     String(query.offset));
  const qs = params.toString();
  return apiClient.get(`audit-logs${qs ? `?${qs}` : ""}`).json();
}

export function exportAuditLogsUrl(query: AuditLogQuery = {}): string {
  const params = new URLSearchParams();
  if (query.eventType)  params.set("eventType",  query.eventType);
  if (query.actorId)    params.set("actorId",    query.actorId);
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.entityId)   params.set("entityId",   query.entityId);
  if (query.from)       params.set("from",        query.from);
  if (query.to)         params.set("to",          query.to);
  const qs = params.toString();
  return `/api/audit-logs/export${qs ? `?${qs}` : ""}`;
}
