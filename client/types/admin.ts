/** Shapes returned by the admin, task, report, and audit endpoints. */

export type StaffType = "maid" | "butler" | null;

export type TimeSlot = { start: string; end: string };

export type DayAvailability = { enabled: boolean; slots: TimeSlot[] };

export type StaffMember = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  admin: boolean;
  active: boolean;
  type: StaffType;
  availability: Record<string, unknown> | null;
};

export type Paginated<K extends string, T> = {
  page: number;
  quantity: number;
  count: number;
  total: number;
} & Record<K, T[]>;

export type StaffListResponse = {
  page: number;
  quantity: number;
  count: number;
  total: number;
  users: StaffMember[];
};

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskAssignee = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
};

export type Task = {
  id: number;
  title: string;
  description: string | null;
  assigned_to: number | null;
  created_by: number | null;
  due_date: string | null;
  event_id: number | null;
  completed: boolean;
  created_at: string | null;
  assignee: TaskAssignee | null;
  creator: { id: number; first_name: string; last_name: string } | null;
  event_title: string | null;
};

export type TaskStats = {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  unassigned: number;
};

export type TaskListResponse = {
  page: number;
  quantity: number;
  count: number;
  total: number;
  stats: TaskStats;
  tasks: Task[];
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export type StaffStats = {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  maids: number;
  butlers: number;
  untyped: number;
  no_availability: number;
};

export type EventStats = {
  total: number;
  upcoming: number;
  past: number;
  draft: number;
  cancelled: number;
};

export type PracticeStats = {
  total: number;
  upcoming: number;
  held: number;
  records: number;
  attended: number;
  attendance_rate: number | null;
};

export type UpcomingEventSummary = {
  id: number;
  title: string;
  start_datetime: string | null;
  end_datetime: string | null;
  location: string | null;
  max_attendees: number | null;
  status: string;
  rsvps: number;
  going: number;
  drivers: number;
  seats_offered: number;
  passengers: number;
  seats_left: number;
  spots_left: number | null;
  over_capacity: boolean;
};

export type SessionSummary = {
  id: number;
  title: string;
  date: string | null;
  recorded: number;
  attended: number;
  late: number;
  attendance_rate: number | null;
};

export type AuditEntry = {
  id: number;
  actor_id: number | null;
  actor_label: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string | null;
  changes: Record<string, unknown> | null;
  created_at: string | null;
};

export type Dashboard = {
  staff: StaffStats;
  events: EventStats;
  practice: PracticeStats;
  tasks: TaskStats;
  invites: { total: number; active: number; used_up: number; expired: number };
  links: { total: number };
  upcoming_events: UpcomingEventSummary[];
  next_practice: {
    id: number;
    title: string;
    date: string | null;
    location: string | null;
  } | null;
  recent_sessions: SessionSummary[];
  attention: { overdue_tasks: Task[]; unassigned_tasks: Task[] };
  recent_activity: AuditEntry[];
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export type PracticeReportRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  active: boolean;
  recorded: number;
  attended: number;
  late: number;
  absent: number;
  last_attended: string | null;
  attendance_rate: number | null;
  late_rate: number | null;
};

export type PracticeReport = {
  sessions_held: number;
  members: PracticeReportRow[];
  sessions: SessionSummary[];
};

export type EventReportRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  rsvps: number;
  going: number;
  maybe: number;
  declined: number;
  driving: number;
};

export type PracticeHistoryEntry = {
  id: number;
  practice_session_id: number;
  title: string;
  date: string | null;
  location: string | null;
  attended: boolean;
  late: boolean;
  notes: string | null;
};

export type PracticeHistory = {
  user: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
    type: StaffType;
  };
  summary: {
    recorded: number;
    attended: number;
    late: number;
    absent: number;
    sessions_held: number;
    attendance_rate: number | null;
    late_rate: number | null;
  };
  history: PracticeHistoryEntry[];
};

// ─── Routines ─────────────────────────────────────────────────────────────────

export type Routine = {
  id: number;
  name: string;
  notes: string | null;
  usage_count: number;
  last_used: string | null;
};

// ─── Event roster (admin override) ────────────────────────────────────────────

export type RosterEntry = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  status: string;
  role: string | null;
  seats_available: number | null;
  notes: string | null;
};

export type EventRoster = {
  event: {
    id: number;
    title: string;
    start_datetime: string;
    end_datetime: string;
    location: string | null;
    max_attendees: number | null;
    status: string;
  };
  summary: {
    attendees: number;
    going: number;
    seats_offered: number;
    passengers: number;
    seats_left: number;
    spots_left: number | null;
  };
  attendances: RosterEntry[];
};

export type Invite = {
  id: number;
  code: string;
  created_by: number | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
};
