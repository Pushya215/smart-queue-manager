import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, Check, X, Building2, Plus, Trash2 } from "lucide-react";

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"emergency" | "tokens" | "institutions">("emergency");

  return (
    <Layout>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {(["emergency", "tokens", "institutions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap ${
              tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {t === "emergency" && "🚨 "}{t}
          </button>
        ))}
      </div>
      {tab === "emergency" && <EmergencyTab />}
      {tab === "tokens" && <TokensTab />}
      {tab === "institutions" && <InstitutionsTab />}
    </Layout>
  );
}

function EmergencyTab() {
  const queryClient = useQueryClient();
  const { data: emergencyTokens, isLoading } = useQuery({
    queryKey: ["emergency-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booked_tokens")
        .select("*")
        .eq("status", "emergency_pending")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const handleApprove = async (token: any) => {
    const { error } = await supabase
      .from("booked_tokens")
      .update({ status: "waiting", emergency_approved: true } as any)
      .eq("id", token.id);

    if (error) {
      toast.error("Failed to approve");
      return;
    }

    // Send approval notification to the user via edge function
    try {
      await supabase.functions.invoke("send-booking-notification", {
        body: {
          userEmail: token.user_email,
          userName: token.user_name,
          userPhone: token.user_phone,
          tokenNumber: token.token_number,
          serviceName: token.service_name,
          institutionName: token.institution_name,
          appointmentTime: token.appointment_time,
          isEmergency: true,
          emergencyApproved: true,
          type: "emergency_approved",
        },
      });
    } catch (err) {
      console.error("Notification error:", err);
    }

    toast.success(`Emergency token #${token.token_number} approved!`);
    queryClient.invalidateQueries({ queryKey: ["emergency-tokens"] });
  };

  const handleReject = async (token: any) => {
    const { error } = await supabase
      .from("booked_tokens")
      .update({ status: "cancelled" })
      .eq("id", token.id);

    if (error) {
      toast.error("Failed to reject");
      return;
    }

    toast.success("Emergency token rejected");
    queryClient.invalidateQueries({ queryKey: ["emergency-tokens"] });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-3">
      {emergencyTokens?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No pending emergency requests.</div>
      ) : (
        emergencyTokens?.map((token) => {
          const t = token as any;
          return (
            <div key={token.id} className="p-4 rounded-xl border-2 border-emergency/30 bg-emergency/5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-emergency animate-pulse-emergency" />
                    <span className="font-semibold">Token #{token.token_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emergency/10 text-emergency font-medium">EMERGENCY</span>
                  </div>
                  <p className="text-sm"><strong>Name:</strong> {token.user_name}</p>
                  <p className="text-sm"><strong>Email:</strong> {token.user_email}</p>
                  <p className="text-sm"><strong>Phone:</strong> {token.user_phone || "N/A"}</p>
                  <p className="text-sm"><strong>Service:</strong> {token.service_name} • {token.institution_name}</p>
                  <p className="text-sm"><strong>Time:</strong> {format(new Date(token.appointment_time), "PPp")}</p>
                  {t.emergency_reason && (
                    <p className="text-sm text-emergency"><strong>Reason:</strong> {t.emergency_reason}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleApprove(token)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(token)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function TokensTab() {
  const queryClient = useQueryClient();
  const { data: tokens } = useQuery({
    queryKey: ["all-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booked_tokens")
        .select("*")
        .in("status", ["waiting", "serving"])
        .order("token_number", { ascending: true });
      return data ?? [];
    },
  });

  const advanceToken = async (id: string) => {
    const { error } = await supabase.from("booked_tokens").update({ status: "serving" }).eq("id", id);
    if (!error) {
      toast.success("Token advanced");
      queryClient.invalidateQueries({ queryKey: ["all-tokens"] });
    }
  };

  const completeToken = async (id: string) => {
    const { error } = await supabase.from("booked_tokens").update({ status: "completed" }).eq("id", id);
    if (!error) {
      toast.success("Token completed");
      queryClient.invalidateQueries({ queryKey: ["all-tokens"] });
    }
  };

  return (
    <div className="space-y-3">
      {tokens?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No active tokens.</div>
      ) : (
        tokens?.map((token) => (
          <div key={token.id} className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
            <div>
              <p className="font-semibold">Token #{token.token_number} - {token.user_name}</p>
              <p className="text-sm text-muted-foreground">{token.service_name} • {token.status}</p>
            </div>
            <div className="flex gap-2">
              {token.status === "waiting" && (
                <button onClick={() => advanceToken(token.id)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm">
                  Serve
                </button>
              )}
              {token.status === "serving" && (
                <button onClick={() => completeToken(token.id)} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm">
                  Complete
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function InstitutionsTab() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [serviceType, setServiceType] = useState("Banking");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const { data: institutions } = useQuery({
    queryKey: ["institutions-all"],
    queryFn: async () => {
      const { data } = await supabase.from("institutions").select("*").order("name");
      return data ?? [];
    },
  });

  const addInstitution = async () => {
    const { error } = await supabase.from("institutions").insert({ name, service_type: serviceType, city, address });
    if (error) toast.error("Failed to add");
    else {
      toast.success("Institution added");
      setShowAdd(false);
      setName(""); setCity(""); setAddress("");
      queryClient.invalidateQueries({ queryKey: ["institutions-all"] });
    }
  };

  const deleteInstitution = async (id: string) => {
    await supabase.from("institutions").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["institutions-all"] });
    toast.success("Deleted");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("institutions").update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["institutions-all"] });
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
        <Plus className="h-4 w-4" /> Add Institution
      </button>

      {showAdd && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-input bg-background">
            {["Banking", "Hospital", "Government", "Gas Agency", "Loans", "Passport Seva"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="w-full px-3 py-2 rounded-lg border border-input bg-background" />
          <button onClick={addInstitution} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Save</button>
        </div>
      )}

      <div className="space-y-2">
        {institutions?.map((inst) => (
          <div key={inst.id} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
            <div>
              <p className="font-medium">{inst.name}</p>
              <p className="text-xs text-muted-foreground">{inst.service_type} • {inst.city}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggleActive(inst.id, inst.is_active)}
                className={`text-xs px-2 py-1 rounded ${inst.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                {inst.is_active ? "Active" : "Inactive"}
              </button>
              <button onClick={() => deleteInstitution(inst.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
