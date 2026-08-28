import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";
import { PageContainer } from "./PageContainer";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";

export interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

/**
 * Scaffold for routes that are wired up (navigable, real URL) but not yet
 * built out. Keeps every unbuilt page visually consistent with the rest of
 * the shell instead of a blank screen or a wall of lorem ipsum.
 */
export function PlaceholderPage({ title, description, icon = Construction }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={icon}
          title="Module not yet implemented"
          description="This section is scaffolded and routed. Implementation lands in a later phase."
        />
      </Card>
    </PageContainer>
  );
}
