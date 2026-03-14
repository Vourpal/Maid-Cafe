"use client"

import { useRouter } from "next/router"

export default function EventFilters(){

    const router = useRouter()

    // function
    return (
        <div>
            look i b filtering n shet
        </div>
    )
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
