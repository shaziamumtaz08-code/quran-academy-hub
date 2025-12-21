import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-6 text-lg">Loading dashboard...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-lg">Not logged in</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div>
        <strong>Logged in as:</strong> {profile.full_name}
      </div>

      <div>
        <strong>Role:</strong> {profile.role}
      </div>

      <div className="mt-6 p-4 border rounded bg-muted">Dashboard is working ✅ (Blank screen issue fixed)</div>
    </div>
  );
}
