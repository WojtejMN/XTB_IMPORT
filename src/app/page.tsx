import { Dashboard } from "@/components/Dashboard";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { PrivacySection } from "@/components/sections/PrivacySection";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Dashboard />
      <HowItWorks />
      <PrivacySection />
    </main>
  );
}
