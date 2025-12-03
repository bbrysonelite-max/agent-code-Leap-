// Sequence Engine Types
// Part of AI Lead OS - TRANSMIT MODULE

export type SequenceStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type StepChannel = "email" | "sms";
export type StepStatus = "pending" | "sent" | "delivered" | "opened" | "clicked" | "replied" | "failed" | "skipped";
export type EnrollmentStatus = "active" | "paused" | "completed" | "replied" | "unsubscribed" | "bounced";

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  settings: SequenceSettings;
  stats: SequenceStats;
  created_at: Date;
  updated_at: Date;
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  order: number;
  channel: StepChannel;
  delay_days: number;
  delay_hours: number;
  subject?: string; // For email
  content: string;
  template_id?: string;
  is_active: boolean;
}

export interface SequenceSettings {
  send_window_start: string; // "09:00"
  send_window_end: string;   // "17:00"
  send_days: number[];       // [1,2,3,4,5] = Mon-Fri
  timezone: string;
  stop_on_reply: boolean;
  stop_on_meeting_booked: boolean;
  daily_send_limit: number;
}

export interface SequenceStats {
  total_enrolled: number;
  active: number;
  completed: number;
  replied: number;
  meetings_booked: number;
  unsubscribed: number;
  emails_sent: number;
  emails_opened: number;
  sms_sent: number;
  sms_replied: number;
}

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  lead_id: string;
  status: EnrollmentStatus;
  current_step: number;
  enrolled_at: Date;
  completed_at?: Date;
  last_activity_at?: Date;
  metadata?: Record<string, any>;
}

export interface ScheduledSend {
  id: string;
  enrollment_id: string;
  step_id: string;
  lead_id: string;
  channel: StepChannel;
  scheduled_for: Date;
  status: "scheduled" | "processing" | "sent" | "failed" | "cancelled";
  attempts: number;
  last_error?: string;
  sent_at?: Date;
}

export interface CreateSequenceRequest {
  name: string;
  description?: string;
  steps: Array<{
    channel: StepChannel;
    delay_days: number;
    delay_hours?: number;
    subject?: string;
    content: string;
  }>;
  settings?: Partial<SequenceSettings>;
}

export interface EnrollLeadRequest {
  sequence_id: string;
  lead_id: string;
  start_immediately?: boolean;
}

export interface BulkEnrollRequest {
  sequence_id: string;
  lead_ids: string[];
  start_immediately?: boolean;
}
