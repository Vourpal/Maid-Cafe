"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

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
        }),
      });

      if (!res.ok) throw new Error("Registration failed");

      setSuccess("Account created successfully!");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <Card className="border-rose-200 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-rose-500 text-2xl">🎀 Join the Team</CardTitle>
          <p className="text-gray-400 text-sm">
            Please provide your information to become a part of the team!
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>First Name</FieldLabel>
                <Input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>Last Name</FieldLabel>
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
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
                <FieldLabel>Username</FieldLabel>
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && (
              <p className="text-green-600 text-sm">{success}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-full"
            >
              Create Account
            </Button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-rose-500 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}