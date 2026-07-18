"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember_me: rememberMe }),
      });

      if (!res.ok) throw new Error("Invalid login");

      const json = await res.json();
      localStorage.setItem("token", json.data.token);

      const meRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${json.data.token}` },
      });
      const meJson = await meRes.json();
      setUser(meJson.data);

      router.push(redirectTo);
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
    });
    localStorage.removeItem("token");
    setUser(null);
    router.push("/login");
  }

  if (user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-8">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 font-bold text-xl flex items-center justify-center mx-auto mb-4">
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <p className="text-gray-700 mb-1 font-medium">{user.first_name} {user.last_name}</p>
          <p className="text-gray-400 text-sm mb-6">You&apos;re already logged in</p>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="border-rose-300 text-rose-500 hover:bg-rose-50 rounded-full"
          >
            Logout
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-rose-400 to-rose-600 px-8 py-8 text-white text-center">
            <p className="text-3xl mb-2">🎀</p>
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-rose-100 text-sm mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-gray-200 focus:ring-rose-300 focus:border-rose-300 rounded-lg"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-gray-200 focus:ring-rose-300 focus:border-rose-300 rounded-lg"
                    required
                  />
                </Field>
              </FieldGroup>

              <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe((p) => !p)}
                  className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                    rememberMe ? "bg-rose-500" : "bg-gray-200"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      rememberMe ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
                Remember me
              </label>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-full h-10 font-medium"
              >
                {loading ? "Signing in..." : "Login"}
              </Button>

              <p className="text-center text-sm text-gray-500">
                New here?{" "}
                <Link href="/login/newUser" className="text-rose-500 hover:underline font-medium">
                  Create an account
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
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
