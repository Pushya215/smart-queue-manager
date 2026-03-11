import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";

export default function MyTokensPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["my-tokens", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("booked_tokens")
        .select("*")
        .eq("user_id", user!.id)
        .order("appointment_time", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const cancelToken = async (id: string) => {
    const { error } = await supabase.from("booked_tokens").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error("Failed to cancel");
    else {
      toast.success("Token cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-tokens"] });
    }
  };

  const statusIcon = (status: string, isEmergency: boolean) => {
    if (isEmergency && status === "emergency_pending") return <AlertTriangle className="h-4 w-4 text-emergency animate-pulse-emergency" />;
    if (status === "waiting") return <Clock className="h-4 w-4 text-primary" />;
    if (status === "serving") return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      waiting: "Waiting",
      serving: "Now Serving",
      completed: "Completed",
      cancelled: "Cancelled",
      emergency_pending: "⚠️ Awaiting Admin Approval",
      emergency_approved: "🚨 Emergency Approved",
    };
    return map[status] || status;
  };

  return (
    <Layout>
      <h1 className="text-3xl font-bold mb-6">My Tokens</h1>
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : tokens?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No tokens booked yet.</div>
      ) : (
        <div className="space-y-3">
          {tokens?.map((token) => {
            const t = token as any;
            return (
              <div
                key={token.id}
                className={`p-4 rounded-xl border bg-card ${
                  t.is_emergency ? "border-emergency/30" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {statusIcon(token.status, t.is_emergency)}
                      <span className="font-semibold">Token #{token.token_number}</span>
                      {t.is_emergency && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emergency/10 text-emergency font-medium">
                          EMERGENCY
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {token.service_name} • {token.institution_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(token.appointment_time), "PPp")}
                    </p>
                    <p className="text-xs font-medium">{statusLabel(token.status)}</p>
                    {t.emergency_reason && (
                      <p className="text-xs text-emergency mt-1">Reason: {t.emergency_reason}</p>
                    )}
                  </div>
                  {(token.status === "waiting" || token.status === "emergency_pending") && (
                    <button
                      onClick={() => cancelToken(token.id)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
