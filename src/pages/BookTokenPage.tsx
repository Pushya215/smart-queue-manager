import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const SERVICE_TYPES = ["Banking", "Hospital", "Government", "Gas Agency", "Loans", "Passport Seva"];

export default function BookTokenPage() {
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: institutions } = useQuery({
    queryKey: ["institutions", serviceType],
    queryFn: async () => {
      const { data } = await supabase
        .from("institutions")
        .select("*")
        .eq("service_type", serviceType)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!serviceType,
  });

  const selectedInstitution = institutions?.find((i) => i.id === institutionId);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    // Get next token number
    const { data: existingTokens } = await supabase
      .from("booked_tokens")
      .select("token_number")
      .eq("service_id", serviceType)
      .eq("institution_id", institutionId)
      .order("token_number", { ascending: false })
      .limit(1);

    const nextToken = (existingTokens?.[0]?.token_number ?? 0) + 1;

    const { error } = await supabase.from("booked_tokens").insert({
      token_number: nextToken,
      service_id: serviceType,
      service_name: serviceType,
      institution_id: institutionId,
      institution_name: selectedInstitution?.name ?? "",
      appointment_time: appointmentTime,
      user_id: user.id,
      user_email: user.email!,
      user_name: userName,
      user_phone: userPhone || null,
      is_emergency: isEmergency,
      emergency_reason: isEmergency ? emergencyReason : null,
      emergency_approved: false,
      status: isEmergency ? "emergency_pending" : "waiting",
    } as any);

    if (error) {
      toast.error("Failed to book token: " + error.message);
    } else {
      toast.success(
        isEmergency
          ? "Emergency token booked! Waiting for admin approval."
          : `Token #${nextToken} booked successfully!`
      );
      // Send notification
      try {
        await supabase.functions.invoke("send-booking-notification", {
          body: {
            userEmail: user.email,
            userName,
            userPhone: userPhone || null,
            tokenNumber: nextToken,
            serviceName: serviceType,
            institutionName: selectedInstitution?.name,
            appointmentTime,
            isEmergency,
            emergencyReason: isEmergency ? emergencyReason : null,
          },
        });
      } catch (err) {
        console.error("Notification error:", err);
      }
      // Reset form
      setServiceType("");
      setInstitutionId("");
      setAppointmentTime("");
      setUserName("");
      setUserPhone("");
      setIsEmergency(false);
      setEmergencyReason("");
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Book a Token</h1>
        <form onSubmit={handleBook} className="space-y-4 bg-card p-6 rounded-xl border border-border">
          {/* Emergency Toggle */}
          <div
            className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              isEmergency ? "border-emergency bg-emergency/5" : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => setIsEmergency(!isEmergency)}
          >
            <AlertTriangle className={`h-5 w-5 ${isEmergency ? "text-emergency animate-pulse-emergency" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <p className="font-medium">Emergency Booking</p>
              <p className="text-xs text-muted-foreground">Requires admin approval. Priority queue access.</p>
            </div>
            <div className={`h-5 w-9 rounded-full transition-colors ${isEmergency ? "bg-emergency" : "bg-muted"} relative`}>
              <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${isEmergency ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
          </div>

          {isEmergency && (
            <div>
              <label className="block text-sm font-medium mb-1">Emergency Reason *</label>
              <textarea
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-emergency"
                placeholder="Describe the emergency situation..."
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Your Name *</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone Number</label>
            <input type="tel" value={userPhone} onChange={(e) => setUserPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="+91 9876543210" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Service Type *</label>
            <select value={serviceType} onChange={(e) => { setServiceType(e.target.value); setInstitutionId(""); }} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Select service</option>
              {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {serviceType && (
            <div>
              <label className="block text-sm font-medium mb-1">Institution *</label>
              <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select institution</option>
                {institutions?.map((i) => <option key={i.id} value={i.id}>{i.name} - {i.city}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Appointment Time *</label>
            <input type="datetime-local" value={appointmentTime} onChange={(e) => setAppointmentTime(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <button type="submit" disabled={loading}
            className={`w-full py-2.5 rounded-lg font-medium transition-opacity disabled:opacity-50 ${
              isEmergency
                ? "bg-emergency text-emergency-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}>
            {loading ? "Booking..." : isEmergency ? "🚨 Book Emergency Token" : "Book Token"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
