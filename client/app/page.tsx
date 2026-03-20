import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-3xl text-center">

        <p className="text-5xl mb-4">🎀</p>

        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Welcome to the Maid Café
        </h1>

        <p className="text-lg text-gray-500 mb-8">
          A cozy place to browse upcoming events, meet new people, and enjoy the charm of our digital café.
        </p>

        <div className="flex justify-center gap-4">
          <Link
            href="/events"
            className="px-6 py-3 bg-rose-500 text-white rounded-full font-medium hover:bg-rose-600 transition"
          >
            Browse Events
          </Link>

          <Link
            href="/login"
            className="px-6 py-3 border border-rose-300 text-rose-500 rounded-full font-medium hover:bg-rose-50 transition"
          >
            Login
          </Link>
        </div>

      </div>
    </div>
  );
}