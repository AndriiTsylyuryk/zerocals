import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderNotificationRequest {
  orderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    // Create Supabase client for auth verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      );
    }

    const { orderId }: OrderNotificationRequest = await req.json();

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch order details with items and pickup location
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        order_items (
          *,
          products (name, price)
        ),
        pickup_locations (
          name,
          address,
          city,
          zip_code
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Fetch all admin emails
    const { data: adminRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError || !adminRoles || adminRoles.length === 0) {
      throw new Error("No admin users found");
    }

    const adminIds = adminRoles.map(role => role.user_id);

    // Get admin profiles with emails
    const { data: adminProfiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", adminIds);

    if (profilesError || !adminProfiles || adminProfiles.length === 0) {
      throw new Error("No admin profiles found");
    }

    const adminEmails = adminProfiles.map(profile => profile.email);

    // Build order items HTML
    const itemsHtml = order.order_items
      .map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.products.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.price_at_purchase.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.quantity * item.price_at_purchase).toFixed(2)}</td>
        </tr>
      `)
      .join("");

    const shippingAddress = order.shipping_address as any;
    
    // Build delivery info HTML based on delivery type
    const deliveryInfoHtml = order.delivery_type === 'pickup' 
      ? `
        <div style="margin: 20px 0;">
          <h2 style="color: #666;">Pickup Information</h2>
          <p><strong>Location:</strong> ${order.pickup_locations?.name || 'N/A'}</p>
          <p><strong>Address:</strong><br/>
            ${order.pickup_locations?.address || ''}<br/>
            ${order.pickup_locations?.city || ''}${order.pickup_locations?.zip_code ? ', ' + order.pickup_locations.zip_code : ''}
          </p>
          <p><strong>Pickup Date:</strong> ${order.pickup_date || 'N/A'}</p>
          <p><strong>Pickup Time:</strong> ${order.pickup_time || 'N/A'}</p>
        </div>
      `
      : `
        <div style="margin: 20px 0;">
          <h2 style="color: #666;">Shipping Information</h2>
          <p><strong>Address:</strong><br/>
            ${shippingAddress?.address || 'N/A'}<br/>
            ${shippingAddress?.city || ''}${shippingAddress?.zipCode ? ', ' + shippingAddress.zipCode : ''}
          </p>
        </div>
      `;

    // Send email to all admins
    const emailResponse = await resend.emails.send({
      from: "Sweet Shop <onboarding@resend.dev>",
      to: adminEmails,
      subject: `New Order #${order.id.slice(0, 8)} - $${order.total_amount.toFixed(2)}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #f0a500; padding-bottom: 10px;">
            🎉 New Order Received!
          </h1>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #666; margin-top: 0;">Order Details</h2>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
            <p><strong>Status:</strong> <span style="background-color: #ffd700; padding: 3px 8px; border-radius: 3px;">${order.status}</span></p>
            <p><strong>Delivery Type:</strong> ${order.delivery_type === 'pickup' ? '📦 Pickup' : '🚚 Shipping'}</p>
          </div>

          <div style="margin: 20px 0;">
            <h2 style="color: #666;">Customer Information</h2>
            <p><strong>Name:</strong> ${order.user_name}</p>
            <p><strong>Email:</strong> ${order.user_email}</p>
          </div>

          ${deliveryInfoHtml}

          <div style="margin: 20px 0;">
            <h2 style="color: #666;">Order Items</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f0f0f0;">
                  <th style="padding: 8px; text-align: left;">Product</th>
                  <th style="padding: 8px; text-align: center;">Qty</th>
                  <th style="padding: 8px; text-align: right;">Price</th>
                  <th style="padding: 8px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; font-size: 1.1em;">
                  <td colspan="3" style="padding: 12px; text-align: right;">Total Amount:</td>
                  <td style="padding: 12px; text-align: right; color: #f0a500;">$${order.total_amount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; color: #666;">
              <strong>Note:</strong> Please process this order as soon as possible. The customer will receive their order confirmation shortly.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Order notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending order notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
