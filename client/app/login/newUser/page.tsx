"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import Link from "next/link";

export default function NewUser() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          username,
          password,
          invite_code: inviteCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error?.message || "Registration failed");
      }

      setSuccess("Account created successfully! You can now log in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-rose-400 to-rose-600 px-8 py-8 text-white text-center">
            <p className="text-3xl mb-2">🎀</p>
            <h1 className="text-2xl font-bold">Join the Team</h1>
            <p className="text-rose-100 text-sm mt-1">
              Create your account with an invite code
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel>First Name</FieldLabel>
                    <Input
                      type="text"
                      placeholder="First"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="border-gray-200 focus:ring-rose-300 rounded-lg"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Last Name</FieldLabel>
                    <Input
                      type="text"
                      placeholder="Last"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="border-gray-200 focus:ring-rose-300 rounded-lg"
                      required
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-gray-200 focus:ring-rose-300 rounded-lg"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Butler/Maid Name</FieldLabel>
                  <Input
                    type="text"
                    placeholder="Your café name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="border-gray-200 focus:ring-rose-300 rounded-lg"
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
                    className="border-gray-200 focus:ring-rose-300 rounded-lg"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>
                    Invite Code{" "}
                    <span className="text-rose-400 font-normal normal-case">required</span>
                  </FieldLabel>
                  <Input
                    type="text"
                    placeholder="Enter your invite code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="border-gray-200 focus:ring-rose-300 rounded-lg uppercase tracking-widest font-mono"
                    required
                  />
                </Field>
              </FieldGroup>

              {error && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-green-600 text-sm bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  {success}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-full h-10 font-medium"
              >
                {loading ? "Creating account..." : "Create Account"}
              </Button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-rose-500 hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
