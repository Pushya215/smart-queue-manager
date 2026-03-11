import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Ticket, Bell, AlertTriangle, Building2 } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: tokens } = useQuery({
    queryKey: ["my-tokens", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("booked_tokens")
        .select("*")
        .eq("user_id", user!.id)
        .order("appointment_time", { ascending: true });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: notifications } = useQuery({
    queryKey: ["unread-notifications", user?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_email", user!.email!)
        .eq("is_read", false);
      return data ?? [];
    },
    enabled: !!user?.email,
  });

  const activeTokens = tokens?.filter((t) => t.status === "waiting" || t.status === "serving") ?? [];
  const emergencyTokens = tokens?.filter((t) => (t as any).is_emergency) ?? [];

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashCard icon={Ticket} label="Active Tokens" value={activeTokens.length} color="bg-primary/10 text-primary" />
          <DashCard icon={AlertTriangle} label="Emergency" value={emergencyTokens.length} color="bg-emergency/10 text-emergency" />
          <DashCard icon={Bell} label="Unread Alerts" value={notifications?.length ?? 0} color="bg-accent text-accent-foreground" />
          <DashCard icon={Building2} label="Total Bookings" value={tokens?.length ?? 0} color="bg-secondary text-secondary-foreground" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/book" className="group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow">
            <Ticket className="h-8 w-8 text-primary mb-3" />
            <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">Book a Token</h2>
            <p className="text-sm text-muted-foreground">Regular or emergency booking</p>
          </Link>
          <Link to="/my-tokens" className="group p-6 rounded-xl border border-border bg-card hover:shadow-lg transition-shadow">
            <Ticket className="h-8 w-8 text-primary mb-3" />
            <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">My Tokens</h2>
            <p className="text-sm text-muted-foreground">View and manage your bookings</p>
          </Link>
        </div>
      </div>
    </Layout>
  );
}

function DashCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card">
      <div className={`inline-flex p-2 rounded-lg ${color} mb-2`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
