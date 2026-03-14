"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";


export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useUserAuthentication();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setError("");

    try {
      const res = await fetch("http://127.0.0.1:5000/auth/login", {
        method: "POST",
        credentials: "include", // IMPORTANT (allows cookies)
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!res.ok) {
        throw new Error("Invalid login");
      }

      const user = await res.json();

      // save user in context
      setUser(user);

      // redirect to home page
      router.push("/");

    } catch (err) {
      setError("Invalid email or password");
    }
  }

  return (
    <div>
      <h1>Login</h1>

      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">
          Login
        </button>

      </form>

      {error && <p>{error}</p>}
    </div>
  );
}
