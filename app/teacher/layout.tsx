import type { ReactNode } from "react";
import TeacherActivitySummary from "./TeacherActivitySummary";
import TeacherLeaderboard from "./TeacherLeaderboard";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <TeacherActivitySummary />
      <TeacherLeaderboard />
    </>
  );
}
