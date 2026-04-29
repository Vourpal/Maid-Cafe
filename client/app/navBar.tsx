"use client";
import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
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
    localStorage.removeItem("token");
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
    <nav className="w-full border-b border-rose-200 bg-white px-4 sm:px-6 py-3 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* LEFT — Logo */}
        <Link
          href="/"
          className="text-rose-500 font-bold text-xl tracking-wide"
        >
          🎀 Maid Cafe
        </Link>

        {/* RIGHT — Nav links */}
        <NavigationMenu className="w-full sm:w-auto">
          <NavigationMenuList className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-2 items-center justify-start sm:justify-end">
            {user && (
              <NavigationMenuItem>
                <NavigationMenuTrigger>Links</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="w-96">
                    <ListItem href="/links?category=excel" title="Excel Sheets">
                      Important excel files available for download.
                    </ListItem>
                    <ListItem href="/links?category=powerpoint" title="Power Points">
                      Important Power Point files available for download
                    </ListItem>
                    <ListItem href="/links?category=misc" title="Miscalleneous">
                      Everything Else
                    </ListItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            )}

            {user && user.admin && (
              <NavigationMenuItem>
                <Link href="/admin">
                  <Button
                    variant="ghost"
                    className="text-gray-700 hover:text-rose-500"
                  >
                    Admin
                  </Button>
                </Link>
              </NavigationMenuItem>
            )}

            <NavigationMenuItem>
              <Link href="/events">
                <Button
                  variant="ghost"
                  className="text-gray-700 hover:text-rose-500"
                >
                  Events
                </Button>
              </Link>
            </NavigationMenuItem>

            {user && (
              <NavigationMenuItem>
                <Link href="/practice">
                  <Button
                    variant="ghost"
                    className="text-gray-700 hover:text-rose-500"
                  >
                    Practice
                  </Button>
                </Link>
              </NavigationMenuItem>
            )}

            {user && (
              <NavigationMenuItem>
                <Link href="/account">
                  <Button
                    variant="ghost"
                    className="text-gray-700 hover:text-rose-500"
                  >
                    {user.first_name}
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
      </div>
    </nav>
  );
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink asChild>
        <Link href={href}>
          <div className="flex flex-col gap-1 text-sm">
            <div className="leading-none font-medium">{title}</div>
            <div className="line-clamp-2 text-muted-foreground">{children}</div>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
