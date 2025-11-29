import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REFUND-ORDER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Refund request started");

    // Initialize Supabase client with service role key for admin operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin verification successful");

    // Get order ID from request
    const { orderId } = await req.json();
    if (!orderId) {
      throw new Error("Order ID is required");
    }
    logStep("Processing refund for order", { orderId });

    // Fetch order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }
    logStep("Order retrieved", { 
      orderId: order.id, 
      status: order.status,
      paymentIntentId: order.stripe_payment_intent_id 
    });

    // Check if order can be refunded
    if (order.status === 'cancelled') {
      throw new Error("Order is already cancelled");
    }

    if (!order.stripe_payment_intent_id) {
      throw new Error("No payment information found for this order");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    logStep("Stripe initialized");

    // Create refund
    logStep("Creating Stripe refund", { paymentIntentId: order.stripe_payment_intent_id });
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      reason: 'requested_by_customer',
    });
    logStep("Refund created successfully", { 
      refundId: refund.id, 
      amount: refund.amount,
      status: refund.status 
    });

    // Update order status to cancelled
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order status: ${updateError.message}`);
    }
    logStep("Order status updated to cancelled");

    // Optionally send email notification to customer
    try {
      logStep("Sending cancellation email to customer");
      await supabaseClient.functions.invoke('send-order-notification', {
        body: { 
          orderId: order.id,
          type: 'cancellation',
          refundAmount: (refund.amount / 100).toFixed(2)
        },
      });
      logStep("Cancellation email sent");
    } catch (emailError) {
      logStep("Failed to send cancellation email", { error: emailError });
      // Don't fail the refund if email fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        refund: {
          id: refund.id,
          amount: refund.amount / 100,
          currency: refund.currency,
          status: refund.status
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in refund-order", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
