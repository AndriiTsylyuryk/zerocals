import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("Session ID is required");
    }
    logStep("Session ID received", { sessionId });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { 
      paymentStatus: session.payment_status,
      orderId: session.metadata?.order_id 
    });

    if (session.payment_status !== "paid") {
      logStep("Payment not completed", { status: session.payment_status });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Payment not completed" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = session.metadata?.order_id;
    if (!orderId) {
      throw new Error("Order ID not found in session metadata");
    }

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Update order status to paid
    const { data: order, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ 
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string
      })
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      logStep("Error updating order", { error: updateError.message });
      throw updateError;
    }

    logStep("Order updated successfully", { orderId, newStatus: "paid" });

    // Send email notifications in background
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Send admin notification
    const sendAdminNotification = async () => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-order-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ orderId }),
        });
        const result = await response.json();
        logStep("Admin notification sent", result);
      } catch (err) {
        logStep("Error sending admin notification", { error: err });
      }
    };

    // Send customer notification
    const sendCustomerNotification = async () => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-customer-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            orderId, 
            notificationType: 'order_received' 
          }),
        });
        const result = await response.json();
        logStep("Customer notification sent", result);
      } catch (err) {
        logStep("Error sending customer notification", { error: err });
      }
    };

    // Fire notifications (don't block response)
    Promise.all([
      sendAdminNotification(),
      sendCustomerNotification()
    ]).catch(err => logStep("Notification error", { error: err }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId,
        message: "Payment verified and order updated" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
