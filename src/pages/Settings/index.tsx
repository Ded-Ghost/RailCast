import { Settings as SettingsIcon } from "lucide-react";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export default function Settings() {
  return (
    <PlaceholderPage
      icon={SettingsIcon}
      title="System Settings"
      description="Configure RailCast operational parameters and display preferences."
    />
  );
}
