import { Activity } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function Predictions() {
  return (
    <PlaceholderPage
      icon={Activity}
      title="Predictions"
      description="ML-driven ETA forecasts, confidence bands, and contributing factors."
    />
  );
}
