import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { profile } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="mt-4 space-y-2">
        <p>
          <strong>Logged in as:</strong> {profile?.full_name}
        </p>
        <p>
          <strong>Role:</strong> {profile?.role}
        </p>
      </div>

      <div className="mt-6 rounded-md bg-green-50 p-4 text-green-700">Dashboard restored successfully ✅</div>
    </div>
  );
}
