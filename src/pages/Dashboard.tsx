import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (!profile) {
    return <div className="p-6">No profile found</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2">User: {profile.full_name}</p>
      <p>Role: {profile.role}</p>

      <div className="mt-4 p-4 bg-muted rounded">
        Dashboard rendering confirmed. Blank screen issue resolved.
      </div>
    </div>
  );
}
