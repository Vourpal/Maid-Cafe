"use client";
import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";
import { authHeadersNoContent } from "@/lib/api";

export default function NavBar() {
  const router = useRouter();
  const { user, setUser, loading } = useUserAuthentication();

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: "POST",
      // credentials: "include",
      headers: authHeadersNoContent(),
    });
    localStorage.removeItem("token")
    setUser(null);
    router.push("/login");
  }

  if (loading)
    return (
      <div className="w-full border-b border-rose-200 bg-white px-6 py-3">
        <Skeleton className="h-8 w-64" />
      </div>
    );

  return (
    <nav className="w-full border-b border-rose-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
      {/* LEFT — Logo */}
      <Link href="/" className="text-rose-500 font-bold text-xl tracking-wide">
        🎀 Maid Cafe
      </Link>

      {/* RIGHT — Nav links */}
      <NavigationMenu>
        <NavigationMenuList className="flex gap-2">
          <NavigationMenuItem>
            <Link href="/events">
              <Button variant="ghost" className="text-gray-700 hover:text-rose-500">
                Events
              </Button>
            </Link>
          </NavigationMenuItem>

          {user && (
            <NavigationMenuItem>
              <Link href="/account">
                <Button variant="ghost" className="text-gray-700 hover:text-rose-500">
                  {user.first_name}
                </Button>
              </Link>
            </NavigationMenuItem>
          )}

          {user && (
            <NavigationMenuItem>
              <Link href="/practice">
                <Button variant="ghost" className="text-gray-700 hover:text-rose-500">
                  Practice
                </Button>
              </Link>
            </NavigationMenuItem>
          )}

          {!user && (
            <NavigationMenuItem>
              <Link href="/login">
                <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-full px-5">
                  Login
                </Button>
              </Link>
            </NavigationMenuItem>
          )}

          {user && (
            <NavigationMenuItem>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-rose-300 text-rose-500 hover:bg-rose-50 rounded-full px-5"
              >
                Logout
              </Button>
            </NavigationMenuItem>
          )}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}