"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string; // same with this
  username: string; // might want to make this unique
  admin: boolean;
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
    const token = localStorage.getItem("token");

    if (!token) {
      setTimeout(() => {
        setUser(null);
        setLoading(false);
      }, 0);
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      // credentials: "include",   change this for when using cookies
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setUser(data.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
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
