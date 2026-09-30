import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userIds, title, body, icon, badge, tag, data } = await req.json();

    console.log(`📤 Sending push to ${userIds.length} users`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    // Get push subscriptions for these users
    const { data: subscriptions, error: fetchError } = await supabase
      .from("user_push_subscriptions")
      .select("*")
      .in("user_id", userIds)
      .eq("enabled", true);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Found ${subscriptions?.length || 0} active subscriptions`);

    // Get VAPID private key
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.error("VAPID keys not configured");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Send push to each subscription
    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscriptions || []) {
      try {
        const subscription = JSON.parse(sub.subscription);

        const pushPayload = {
          title,
          body,
          icon,
          badge,
          tag,
          data,
          timestamp: new Date().toISOString(),
        };

        // Send via Web Push
        const response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `vapid t=${generateVapidToken(
              vapidPrivateKey,
              vapidPublicKey
            )}, k=${vapidPublicKey}`,
          },
          body: JSON.stringify(pushPayload),
        });

        if (response.ok) {
          successCount++;
          console.log(`✅ Push sent to ${sub.user_id}`);
        } else if (response.status === 410) {
          // Subscription expired
          await supabase
            .from("user_push_subscriptions")
            .update({ enabled: false })
            .eq("id", sub.id);
          failureCount++;
        } else {
          failureCount++;
          console.error(`Failed to send push: ${response.status}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`Error sending push to ${sub.user_id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        total: subscriptions?.length || 0,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Generate VAPID JWT token for Web Push
 */
function generateVapidToken(privateKey: string, publicKey: string): string {
  // This is a simplified version - in production, use a proper JWT library
  // For now, we'll return a placeholder
  console.warn("Note: VAPID token generation requires proper JWT implementation");
  return "";
}
