import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BlogSitesList } from "@/components/blogs/BlogSitesList";
import { BlogSiteDetail } from "@/components/blogs/BlogSiteDetail";

interface BlogSite {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function Blogs() {
  const [selectedSite, setSelectedSite] = useState<BlogSite | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {selectedSite ? (
          <BlogSiteDetail site={selectedSite} onBack={() => setSelectedSite(null)} />
        ) : (
          <BlogSitesList onSelectSite={setSelectedSite} />
        )}
      </div>
    </DashboardLayout>
  );
}
