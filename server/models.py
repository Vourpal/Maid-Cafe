from typing import Optional
from zoneinfo import ZoneInfo
from pydantic import BaseModel, ConfigDict
from datetime import datetime

class InviteCreate(BaseModel):
    max_uses: int = 1
    expires_at: Optional[datetime] = None


class Invite(BaseModel):
    id: int
    code: str
    created_by: Optional[int]
    max_uses: int
    uses: int
    expires_at: Optional[datetime]

class UserBase(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str


class UserMe(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    username: str
    admin: bool

    type: str | None = None
    availability: dict | None = None


class UserRegister(BaseModel):
    first_name: str
    last_name: str
    email: str
    username: str
    password: str


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    username: str | None = None
    password: str | None = None
    type: str | None = None
    availability: dict | None = None


class AdminUserUpdate(UserUpdate):
    """Everything a user can change about themselves, plus the two flags only
    an admin may set."""

    model_config = ConfigDict(extra="forbid")

    admin: bool | None = None
    active: bool | None = None


class AdminStaffMember(BaseModel):
    """Row shape for the admin staff directory. Unlike UserMe this exposes
    `active`, which admins need in order to manage accounts."""

    id: int
    first_name: str
    last_name: str
    email: str
    username: str
    admin: bool
    active: bool
    type: str | None = None
    availability: dict | None = None


class UserAuthorization(UserBase):
    id: int | None = None
    password: str
    admin: bool = False
    active: bool = True


class Event(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    start_datetime: datetime
    end_datetime: datetime
    created_by: int  # user_id
    location: str | None = None
    max_attendees: int | None = None
    status: str = "draft"


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    location: str | None = None
    max_attendees: int | None = None
    status: str | None = None


class AdminEventInfo(BaseModel):
    title: str
    driver_count: int
    passenger_count: int = 0
    attendees: list[dict] = []


class NewAttendance(BaseModel):
    user_id: int
    event_id: int
    status: str
    notes: str | None = None
    role: str | None = None
    seats_available: int | None = None


class Attendance(BaseModel):
    id: int | None = None
    user_id: int
    event_id: int
    status: str  # "going", "not_going", "maybe"
    notes: str | None = None
    role: str | None = None
    seats_available: int | None = None


class UpdatedAttendance(BaseModel):
    status: str | None = None
    seats_available: int | None = None
    role: str | None = None


class AdminAttendanceUpdate(BaseModel):
    """Admin override of somebody else's RSVP. Adds `notes`, which members
    cannot edit through UpdatedAttendance."""

    model_config = ConfigDict(extra="forbid")

    status: str | None = None
    seats_available: int | None = None
    role: str | None = None
    notes: str | None = None


class AdminAttendanceCreate(BaseModel):
    """Admin signing a member up on their behalf."""

    model_config = ConfigDict(extra="forbid")

    user_id: int
    status: str
    role: str | None = None
    seats_available: int | None = None
    notes: str | None = None


class Task(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    assigned_to: int | None = None  # user_id
    created_by: int
    due_date: datetime | None = None
    event_id: int | None = None
    completed: bool = False


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: str | None = None
    assigned_to: int | None = None
    due_date: datetime | None = None
    event_id: int | None = None
    completed: bool = False


class TaskUpdate(BaseModel):
    """Partial update. Unset fields are left alone; explicit nulls clear the
    column (that is how a task gets unassigned or has its due date removed),
    so the query layer uses exclude_unset rather than None-checks."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    assigned_to: int | None = None
    due_date: datetime | None = None
    event_id: int | None = None
    completed: bool | None = None


class RoutineCreate(BaseModel):
    """A routine is more than a name: the music, its length and BPM, a reference
    video and the formation are what people actually need at practice."""

    model_config = ConfigDict(extra="forbid")

    name: str
    notes: str | None = None
    music_url: str | None = None
    video_url: str | None = None
    duration_seconds: int | None = None
    bpm: int | None = None
    formation_notes: str | None = None
    difficulty: str | None = None  # easy | medium | hard
    member_count: int | None = None


class RoutineUpdate(BaseModel):
    """Partial update. Unset fields are left alone; an explicit null clears a
    nullable column (that is how a music link or BPM is removed), so the query
    layer uses exclude_unset rather than None-checks."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    notes: str | None = None
    music_url: str | None = None
    video_url: str | None = None
    duration_seconds: int | None = None
    bpm: int | None = None
    formation_notes: str | None = None
    difficulty: str | None = None
    member_count: int | None = None


class PracticeSession(BaseModel):
    id: int | None = None
    title: str
    location: str | None = None
    date: datetime
    notes: str | None = None

    model_config = {"arbitrary_types_allowed": True}

    @property
    def date_utc(self) -> datetime:
        if self.date.tzinfo is None:
            # If no timezone info, assume UTC
            return self.date.replace(tzinfo=ZoneInfo("UTC"))
        return self.date.astimezone(ZoneInfo("UTC"))


# ══════════════════════════════════════════════════════════════════════════════
# EVENT POSITIONS / SHIFTS
# ══════════════════════════════════════════════════════════════════════════════


class PositionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    color: str | None = None
    active: bool = True


class PositionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    color: str | None = None
    active: bool | None = None


class AssignmentCreate(BaseModel):
    """One person in one job. starts_at/ends_at are optional so a simple event
    can assign jobs without shift times, while a shift-based event can give the
    same person the same role twice at different times."""

    model_config = ConfigDict(extra="forbid")

    user_id: int
    position_id: int
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    notes: str | None = None


class AssignmentBulkCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assignments: list[AssignmentCreate]


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int | None = None
    position_id: int | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    notes: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# ROUTINE PROFICIENCY
# ══════════════════════════════════════════════════════════════════════════════
# The routine detail fields live on RoutineCreate/RoutineUpdate above.


class ProficiencySet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int
    level: str  # learning | can_perform | lead
    notes: str | None = None


class ProficiencyBulkSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[ProficiencySet]


# ══════════════════════════════════════════════════════════════════════════════
# COSTUMES & PROPS
# ══════════════════════════════════════════════════════════════════════════════


class CostumeItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    category: str = "costume"  # costume | prop | accessory | wig | other
    description: str | None = None
    size: str | None = None
    color: str | None = None
    owner_id: int | None = None  # null = group-owned
    condition: str = "good"  # good | needs_repair | needs_cleaning | retired
    quantity: int = 1
    storage_location: str | None = None
    notes: str | None = None


class CostumeItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    category: str | None = None
    description: str | None = None
    size: str | None = None
    color: str | None = None
    owner_id: int | None = None
    condition: str | None = None
    quantity: int | None = None
    storage_location: str | None = None
    notes: str | None = None


class CostumeCheckout(BaseModel):
    """Hand an item to somebody, optionally for a specific event."""

    model_config = ConfigDict(extra="forbid")

    user_id: int | None = None
    event_id: int | None = None
    due_back_at: datetime | None = None
    notes: str | None = None


class CostumeReturn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    condition: str | None = None  # update item condition on the way back in
    notes: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# MENU MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════


class MenuItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    category: str = "food"  # food | drink | dessert | special | other
    description: str | None = None
    price: float | None = None
    allergens: str | None = None
    dietary: str | None = None
    active: bool = True
    notes: str | None = None


class MenuItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    category: str | None = None
    description: str | None = None
    price: float | None = None
    allergens: str | None = None
    dietary: str | None = None
    active: bool | None = None
    notes: str | None = None


class EventMenuItemCreate(BaseModel):
    """Put a catalog item on one event's menu."""

    model_config = ConfigDict(extra="forbid")

    menu_item_id: int
    assigned_to: int | None = None
    quantity_planned: int | None = None
    price_override: float | None = None
    notes: str | None = None


class EventMenuItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assigned_to: int | None = None
    quantity_planned: int | None = None
    price_override: float | None = None
    notes: str | None = None


# ══════════════════════════════════════════════════════════════════════════════
# ANNOUNCEMENTS
# ══════════════════════════════════════════════════════════════════════════════


class AnnouncementCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    body: str
    priority: str = "normal"  # normal | important | urgent
    pinned: bool = False
    published: bool = True
    expires_at: datetime | None = None
    event_id: int | None = None


class AnnouncementUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    body: str | None = None
    priority: str | None = None
    pinned: bool | None = None
    published: bool | None = None
    expires_at: datetime | None = None
    event_id: int | None = None
