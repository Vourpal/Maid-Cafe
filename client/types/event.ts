export type Event = {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;  // IMPORTANT: string, not Date
  end_datetime: string;
  created_by: number;
  location: string | null;
  max_attendees: number | null;
  status: string;
};

export type PracticeSessions = {
  id: number;
  title: string;
  location: string;
  date: string;
  notes: string;
};