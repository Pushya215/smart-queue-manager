import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { format } from "date-fns";
import { Bell, Check } from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_email", user!.email!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user?.email,
  });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ is_read: true }).eq("user_email", user!.email!);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="text-sm px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent">
          Mark all read
        </button>
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : notifications?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications?.map((n) => (
            <div key={n.id} className={`p-4 rounded-xl border ${n.is_read ? "border-border bg-card" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">{format(new Date(n.created_at), "PPp")}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="p-1.5 rounded-lg hover:bg-accent" title="Mark as read">
                    <Check className="h-4 w-4 text-primary" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
