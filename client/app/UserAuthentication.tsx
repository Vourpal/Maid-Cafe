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
  name: string;
  email: string;
};

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserAuthenticationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { //this is used for auto-login on refresh
    fetch("http://127.0.0.1:5000/auth/me", {
      credentials: "include",
    })
      .then(res => res.json())
      .then(data => setUser(data.data))
      .catch(() => setUser(null));
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
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
