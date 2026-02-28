"use client";

import { ProfileEditor } from "@/components/profile/profile-editor";

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <ProfileEditor />
      </div>
    </div>
  );
}
