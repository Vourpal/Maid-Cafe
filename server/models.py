from typing import Optional
from zoneinfo import ZoneInfo
from pydantic import BaseModel
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
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    username: str | None = None
    password: str | None = None

    # ✅ NEW FIELDS
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


class Task(BaseModel):
    id: int | None = None
    title: str
    description: str | None = None
    assigned_to: int | None = None  # user_id
    created_by: int
    due_date: datetime | None = None
    event_id: int | None = None
    completed: bool = False


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
