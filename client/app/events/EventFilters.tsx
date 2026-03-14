"use client";
// probably do a toggle for me making it so that all the events are specifically about them.. maybe then add further filters?
import { useRouter } from "next/navigation";

export default function EventFilters() {
  const router = useRouter();

  // function
  return (
    <div>
      <select>
        <option value="user">Me</option>
      </select>
    </div>
  );
}

// "use client";

// import { useRouter } from "next/navigation";

// export default function Filters() {
//   const router = useRouter();

//   function goToTampa() {
//     router.push("/events?location=tampa&page=1");
//   }

//   return <button onClick={goToTampa}>Tampa events</button>;
// }
