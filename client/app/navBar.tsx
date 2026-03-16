"use client";
import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { useRouter } from "next/navigation";

export default function NavBar() {
  const router = useRouter();
  const { user, setUser, loading } = useUserAuthentication();
  async function handleLogout() {
    await fetch("http://localhost:5000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    router.push("/login");
  }
  if (loading) return null;
  return (
    <div>
      <ul className="flex gap-4 justify-center">
        <li>
          <Link href="/">Home</Link>
        </li>
        <li>
          <Link href="/events">Events</Link>
        </li>
        {!user && (
          <li>
            <Link href="/login">Login</Link>
          </li>
        )}
        {user && (
          <li>
            <button onClick={handleLogout}>Logout</button>
          </li>
        )}
      </ul>
    </div>
  );
}
