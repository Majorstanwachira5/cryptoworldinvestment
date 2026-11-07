import { loadState, saveState } from "@/lib/db/persistence";
import { SupabaseSync } from "@/lib/supabase/sync";

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  outcome: "SUCCESS" | "FAILED" | "REJECTED";
  details?: Record<string, any>;
}

const AUDIT_STORE_FILE = "cryptohub-audit";

function loadInitialLogs(): AuditLogEntry[] {
  const loaded = loadState<{ logs: AuditLogEntry[] }>(AUDIT_STORE_FILE);
  if (loaded && Array.isArray(loaded.logs)) {
    return loaded.logs;
  }
  return [];
}

// Durable in-memory + persisted audit trail + Supabase sync
const auditLogs: AuditLogEntry[] = loadInitialLogs();

export class AuditService {
  public static log(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const record: AuditLogEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    auditLogs.unshift(record);
    if (auditLogs.length > 1000) {
      auditLogs.length = 1000;
    }
    saveState(AUDIT_STORE_FILE, { logs: auditLogs });
    SupabaseSync.syncAuditLog(record);
    return record;
  }

  public static getLogs(limit: number = 100): AuditLogEntry[] {
    return auditLogs.slice(0, limit);
  }

  public static count(): number {
    return auditLogs.length;
  }
}
