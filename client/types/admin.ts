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

export type RoutineDifficulty = "easy" | "medium" | "hard";

export type Routine = {
  id: number;
  name: string;
  notes: string | null;
  usage_count: number;
  /** Absent on the single-routine endpoint, which does not aggregate sessions. */
  last_used?: string | null;
  music_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  bpm: number | null;
  formation_notes: string | null;
  difficulty: RoutineDifficulty | null;
  /** How many bodies the formation needs, used to work out readiness. */
  member_count: number | null;
  /** Active members at can_perform or better. Catalog listing only. */
  ready_count?: number;
  tracked_count?: number;
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

// ─── Event positions & shifts ─────────────────────────────────────────────────

export type Position = {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  active: boolean;
  usage_count: number;
};

export type Assignment = {
  id: number;
  event_id: number;
  user_id: number;
  position_id: number;
  /** Null on both ends means the assignment covers the whole event. */
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  created_at: string | null;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  position_name: string;
  position_color: string | null;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  event_location: string | null;
  event_status: string;
};

export type CoverageGap = {
  start: string;
  end: string;
  minutes: number;
};

export type PositionCoverage = {
  position_id: number;
  name: string;
  color: string | null;
  assignments: number;
  people: number;
  /** At least one assignment has no times, so it covers the full event. */
  whole_event: boolean;
  covered: boolean;
  gaps: CoverageGap[];
};

export type DoubleBooking = {
  user_id: number;
  name: string;
  first: {
    id: number;
    position_name: string;
    starts_at: string | null;
    ends_at: string | null;
  };
  second: {
    id: number;
    position_name: string;
    starts_at: string | null;
    ends_at: string | null;
  };
};

export type UnassignedSignup = {
  user_id: number;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  status: string;
};

export type EventAssignments = {
  event: {
    id: number;
    title: string;
    start_datetime: string;
    end_datetime: string;
    location: string | null;
    status: string;
  };
  summary: {
    assignments: number;
    people_assigned: number;
    signups: number;
    positions_total: number;
    positions_filled: number;
    unassigned_count: number;
  };
  positions: Position[];
  assignments: Assignment[];
  coverage: PositionCoverage[];
  unfilled_positions: PositionCoverage[];
  gaps: (CoverageGap & { position_id: number; name: string })[];
  double_booked: DoubleBooking[];
  unassigned_signups: UnassignedSignup[];
};

export type EventShiftSummary = {
  event_id: number;
  title: string;
  start_datetime: string | null;
  end_datetime: string | null;
  location: string | null;
  status: string;
  assignments: number;
  positions_filled: number;
  signups: number;
  people_assigned: number;
  people_unassigned: number;
};

// ─── Routine proficiency ──────────────────────────────────────────────────────

export type ProficiencyLevel = "learning" | "can_perform" | "lead";

export type ProficiencyMember = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  type: StaffType;
  active: boolean;
};

export type ProficiencyEntry = {
  user_id: number;
  routine_id: number;
  level: ProficiencyLevel;
  notes: string | null;
  updated_at: string | null;
};

export type RoutineReadiness = {
  routine_id: number;
  name: string;
  member_count: number | null;
  learning: number;
  can_perform: number;
  lead: number;
  /** Active members at can_perform or better. */
  ready: number;
  short_by: number | null;
  performable: boolean;
};

export type ProficiencyMatrix = {
  members: ProficiencyMember[];
  routines: Routine[];
  entries: ProficiencyEntry[];
  readiness: RoutineReadiness[];
};

export type MyProficiency = {
  routine_id: number;
  name: string;
  level: ProficiencyLevel;
  notes: string | null;
  updated_at: string | null;
  music_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  bpm: number | null;
  difficulty: string | null;
};

// ─── Costumes & props ─────────────────────────────────────────────────────────

export type CostumeCategory = "costume" | "prop" | "accessory" | "wig" | "other";

export type CostumeCondition =
  | "good"
  | "needs_repair"
  | "needs_cleaning"
  | "retired";

/** Derived server-side from condition plus the open checkout rows. */
export type CostumeStatus =
  | "available"
  | "assigned"
  | "partially_out"
  | "in_repair"
  | "in_laundry"
  | "retired";

export type CostumeItem = {
  id: number;
  name: string;
  category: CostumeCategory;
  description: string | null;
  size: string | null;
  color: string | null;
  owner_id: number | null;
  condition: CostumeCondition;
  quantity: number;
  storage_location: string | null;
  notes: string | null;
  created_at: string | null;
  owner: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
  group_owned: boolean;
  out_count: number;
  available_count: number;
  status: CostumeStatus;
};

export type CostumeCheckoutRecord = {
  id: number;
  item_id: number;
  user_id: number | null;
  event_id: number | null;
  checked_out_at: string | null;
  due_back_at: string | null;
  returned_at: string | null;
  notes: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  item_name: string;
  item_category: CostumeCategory;
  open: boolean;
  overdue: boolean;
};

export type CostumeStats = {
  total: number;
  costumes: number;
  props: number;
  group_owned: number;
  member_owned: number;
  needs_repair: number;
  needs_cleaning: number;
  retired: number;
  checked_out: number;
  overdue: number;
};

export type CostumeListResponse = {
  page: number;
  quantity: number;
  count: number;
  total: number;
  stats: CostumeStats;
  items: CostumeItem[];
};

export type CostumeDetail = {
  item: CostumeItem;
  history: CostumeCheckoutRecord[];
};

export type CheckoutResult = {
  assignment: CostumeCheckoutRecord;
  item: CostumeItem;
  /** Non-blocking clashes: copies remain, but the item is out elsewhere too. */
  warnings: string[];
};

// ─── Menu ─────────────────────────────────────────────────────────────────────

export type MenuCategory = "food" | "drink" | "dessert" | "special" | "other";

export type MenuItem = {
  id: number;
  name: string;
  category: MenuCategory;
  description: string | null;
  price: number | null;
  allergens: string | null;
  dietary: string | null;
  active: boolean;
  notes: string | null;
  created_at: string | null;
  event_count: number;
};

export type MenuStats = {
  total: number;
  active: number;
  food: number;
  drink: number;
  dessert: number;
  with_allergens: number;
};

export type MenuListResponse = {
  page: number;
  quantity: number;
  count: number;
  total: number;
  stats: MenuStats;
  menu_items: MenuItem[];
};

export type EventMenuItem = {
  id: number;
  event_id: number;
  menu_item_id: number;
  assigned_to: number | null;
  quantity_planned: number | null;
  price_override: number | null;
  notes: string | null;
  name: string;
  category: MenuCategory;
  description: string | null;
  catalog_price: number | null;
  /** price_override when set, otherwise the catalog price. */
  price: number | null;
  allergens: string | null;
  dietary: string | null;
  assignee: {
    id: number;
    first_name: string;
    last_name: string;
    username: string;
  } | null;
};

export type EventMenu = {
  event: {
    id: number;
    title: string;
    start_datetime: string;
    end_datetime: string;
    status: string;
  };
  summary: {
    items: number;
    unassigned: number;
    with_allergens: number;
    projected_revenue: number | null;
  };
  items: EventMenuItem[];
};

// ─── Announcements ────────────────────────────────────────────────────────────

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type Announcement = {
  id: number;
  title: string;
  body: string;
  created_by: number | null;
  author_label: string | null;
  priority: AnnouncementPriority;
  pinned: boolean;
  published: boolean;
  expires_at: string | null;
  event_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  event_title: string | null;
};

export type AnnouncementStats = {
  total: number;
  live: number;
  pinned: number;
  drafts: number;
  expired: number;
};

export type AnnouncementListResponse = {
  page: number;
  quantity: number;
  count: number;
  total: number;
  announcements: Announcement[];
  /** Only present for admins — members cannot see draft counts. */
  stats?: AnnouncementStats;
};
