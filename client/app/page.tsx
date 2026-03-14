import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <Link href="/events">
        <button>This is the nice little Events Page</button>
      </Link>
    </div>
  );
}
