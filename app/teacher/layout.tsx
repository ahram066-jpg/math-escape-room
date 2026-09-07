import type { ReactNode } from "react";
import TeacherLeaderboard from "./TeacherLeaderboard";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TeacherLeaderboard />
    </>
  );
}
