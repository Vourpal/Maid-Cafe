"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = useUserAuthentication();

  const redirectTo = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  function handleLoginDuration() {
    setRememberMe((prev) => !prev);
  }

async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setError("");

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember_me: rememberMe }),
    });

    if (!res.ok) throw new Error("Invalid login");

    const json = await res.json();
    localStorage.setItem("token", json.data.token);

    // Fetch full user data from /me
    const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${json.data.token}` },
    });
    const meJson = await meRes.json();
    setUser(meJson.data);

    router.push(redirectTo);
  } catch (err) {
    setError("Invalid email or password");
  }
}

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      // credentials: "include",
    });
    localStorage.removeItem("token")
    setUser(null);
    router.push("/login");
  }

  if (user) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <p className="text-gray-700 mb-4">
          Logged in as{" "}
          <span className="font-semibold text-rose-500">{user.first_name}</span>
        </p>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="border-rose-300 text-rose-500 hover:bg-rose-50 rounded-full"
        >
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card className="border-rose-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-rose-500 text-2xl">🎀 Welcome Back</CardTitle>
          <p className="text-gray-400 text-sm">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </FieldGroup>

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={handleLoginDuration}
                className="accent-rose-500"
              />
              Remember me
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-full"
            >
              Login
            </Button>

            <p className="text-center text-sm text-gray-500">
              New here?{" "}
              <Link href="/login/newUser" className="text-rose-500 hover:underline">
                Create an account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}