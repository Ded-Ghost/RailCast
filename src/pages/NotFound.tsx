import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";

export default function NotFound() {
  return (
    <PageContainer>
      <Card>
        <EmptyState
          icon={Compass}
          title="Page not found"
          description="The page you're looking for doesn't exist or has moved."
          action={
            <Link
              to="/"
              className="mt-2 inline-flex h-9 items-center justify-center rounded bg-primary px-4 text-body-md font-medium text-on-primary transition-colors hover:bg-primary-container"
            >
              Back to Dashboard
            </Link>
          }
        />
      </Card>
    </PageContainer>
  );
}
