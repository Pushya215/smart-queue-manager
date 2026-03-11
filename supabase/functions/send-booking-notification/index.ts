import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      userEmail,
      userName,
      userPhone,
      tokenNumber,
      serviceName,
      institutionName,
      appointmentTime,
      isEmergency,
      emergencyReason,
      emergencyApproved,
      type,
    } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    let emailSubject = "";
    let emailBody = "";
    let notificationTitle = "";
    let notificationMessage = "";

    if (type === "emergency_approved") {
      emailSubject = `🚨 Emergency Token #${tokenNumber} Approved!`;
      emailBody = `
        <h2>Your Emergency Token Has Been Approved!</h2>
        <p>Dear ${userName},</p>
        <p>Your emergency token <strong>#${tokenNumber}</strong> for <strong>${serviceName}</strong> at <strong>${institutionName}</strong> has been approved by the admin.</p>
        <p><strong>Appointment Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        <p>You are now in the priority queue. Please arrive on time.</p>
      `;
      notificationTitle = "Emergency Approved!";
      notificationMessage = `Your emergency token #${tokenNumber} for ${serviceName} at ${institutionName} has been approved.`;
    } else if (isEmergency) {
      emailSubject = `🚨 Emergency Token #${tokenNumber} - Pending Approval`;
      emailBody = `
        <h2>Emergency Token Booking Received</h2>
        <p>Dear ${userName},</p>
        <p>Your emergency token <strong>#${tokenNumber}</strong> for <strong>${serviceName}</strong> at <strong>${institutionName}</strong> has been submitted.</p>
        <p><strong>Emergency Reason:</strong> ${emergencyReason}</p>
        <p><strong>Appointment Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        <p>This booking requires admin approval. You will be notified once approved.</p>
      `;
      notificationTitle = "Emergency Token Submitted";
      notificationMessage = `Emergency token #${tokenNumber} for ${serviceName} submitted. Awaiting admin approval.`;
    } else {
      emailSubject = `Token #${tokenNumber} Booked - ${serviceName}`;
      emailBody = `
        <h2>Token Booking Confirmation</h2>
        <p>Dear ${userName},</p>
        <p>Your token <strong>#${tokenNumber}</strong> for <strong>${serviceName}</strong> at <strong>${institutionName}</strong> has been booked.</p>
        <p><strong>Appointment Time:</strong> ${new Date(appointmentTime).toLocaleString()}</p>
        <p>You will receive reminders before your appointment.</p>
      `;
      notificationTitle = "Token Booked!";
      notificationMessage = `Token #${tokenNumber} for ${serviceName} at ${institutionName} booked for ${new Date(appointmentTime).toLocaleString()}.`;
    }

    // Send email to THE USER who booked (not a fixed admin email)
    if (resendApiKey && userEmail) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Smart Queue <onboarding@resend.dev>",
            to: [userEmail],
            subject: emailSubject,
            html: emailBody,
          }),
        });
        console.log(`Email sent to ${userEmail}`);
      } catch (emailErr) {
        console.error("Email error:", emailErr);
      }
    }

    // Send SMS to user's phone number via Twilio
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber && userPhone) {
      try {
        const smsBody = `${notificationTitle}\n${notificationMessage}`;
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

        const formData = new URLSearchParams();
        formData.append("To", userPhone);
        formData.append("From", twilioPhoneNumber);
        formData.append("Body", smsBody);

        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          },
          body: formData.toString(),
        });
        console.log(`SMS sent to ${userPhone}`);
      } catch (smsErr) {
        console.error("SMS error:", smsErr);
      }
    }

    // Store in-app notification
    await supabase.from("notifications").insert({
      user_email: userEmail,
      title: notificationTitle,
      message: notificationMessage,
      type: isEmergency ? "emergency" : "reminder",
      alert_type: isEmergency ? "emergency" : "booking",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
