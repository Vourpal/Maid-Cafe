"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = useUserAuthentication();

  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:5000/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error("Invalid login");

      const json = await res.json();
      setUser(json.data);

      router.push(redirectTo);

    } catch (err) {
      setError("Invalid email or password");
    }
  }

  async function handleLogout() {
    await fetch("http://localhost:5000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    router.push("/login");
  }

  return (
    <div>
      <h1>Login</h1>

      {user ? (
        <div>
          <p>Logged in as {user.first_name}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="text"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Login</button>
        </form>
      )}

      <Link href={"/login/newUser"}>New User</Link>
      {error && <p>{error}</p>}
    </div>
  );
}