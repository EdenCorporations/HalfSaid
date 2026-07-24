/** Row → DTO mapping shared by the node/timeline handlers. */

import type { PcgNodeDTO, PrivacyTier } from '@halfsaid/shared-types';

export interface NodeRow {
  id: string;
  node_type: string;
  attributes: Record<string, unknown> | null;
  event_time: string | Date;
  ingestion_time: string | Date;
  superseded_by: string | null;
  privacy_tier: number;
  salience: number | string;
}

export function iso(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

export function rowToNodeDTO(r: NodeRow): PcgNodeDTO {
  return {
    id: r.id,
    nodeType: r.node_type as PcgNodeDTO['nodeType'],
    attributes: r.attributes ?? {},
    eventTime: iso(r.event_time),
    ingestionTime: iso(r.ingestion_time),
    supersededBy: r.superseded_by,
    privacyTier: r.privacy_tier as PrivacyTier,
    salience: Number(r.salience),
  };
}

export const NODE_COLUMNS =
  'id, node_type, attributes, event_time, ingestion_time, superseded_by, privacy_tier, salience';
