import { redirect } from "next/navigation";

/**
 * Root page for core mode.
 * No marketing page — redirect straight to the projects dashboard.
 */
export default function HomePage() {
  redirect("/projects");
}
