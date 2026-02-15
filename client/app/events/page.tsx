type jsonEvent = {
    id: number;
    title: string
    description: string
    start_datetime: Date
    end_datetime: Date
    created_by: number
    location: string
    max_attendees: number
}

export default async function Event() {
  const res = await fetch("http://127.0.0.1:5000/events?page=1&quantity=10");
  const data = await res.json();
  console.log(data);
  return (
    <div>
      <p>yippee this is where we will test the events i guess?</p>
      <div>
        {data.data.events.map((event: jsonEvent) => (
          <div key={event.id}>
            <li >{event.title}</li>
            <li>description: {event.description}</li>
          <li>Located in: {event.location} </li>
          <li>Only {event.max_attendees} allowed in the event</li>
          </div>
        ))}
      </div>
    </div>
  );
}
