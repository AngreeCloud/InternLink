"use client";

import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSupportSection } from "@/components/profile/profile-support-section";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <ProfileEditor />
        <ProfileSupportSection />
      </div>
    </div>
  );
}
