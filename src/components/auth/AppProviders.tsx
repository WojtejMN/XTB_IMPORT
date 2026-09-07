"use client";

import { AuthModal } from "@/components/auth/AuthModal";
import { AuthProvider } from "@/components/auth/AuthProvider";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <AuthModal />
    </AuthProvider>
  );
}
