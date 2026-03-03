import { getCurrentUser } from "@/lib/auth";
import MarketingPage from "./marketing-page";

export default async function HomePage() {
  const user = await getCurrentUser();

  return <MarketingPage isAuthenticated={!!user} />;
}
