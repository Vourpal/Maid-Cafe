"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Availability = {
  [day: string]: {
    enabled: boolean;
    start?: string;
    end?: string;
  };
};

type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  admin: boolean;

  type?: "maid" | "butler" | null;
  availability?: Availability;
};
type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
  loading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserAuthenticationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const token = localStorage.getItem("token");

      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch user");
        }

        const data = await res.json();

        // 🔥 normalize user data (prevents undefined issues)
        const normalizedUser: User = {
          ...data.data,
          is_maid: data.data.is_maid ?? false,
          is_butler: data.data.is_butler ?? false,
          availability: data.data.availability ?? "",
        };

        setUser(normalizedUser);
      } catch (error) {
        console.error("Auth error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserAuthentication() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("Must use inside provider");
  }

  return context;
}
