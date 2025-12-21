import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!profile) {
    return <div className="p-6">Please login again</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2">
        Logged in as: <b>{profile.full_name}</b>
      </p>
      <p>
        Role: <b>{profile.role || "NOT ASSIGNED"}</b>
      </p>
    </div>
  );
}
