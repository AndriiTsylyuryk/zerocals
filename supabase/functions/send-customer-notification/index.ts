import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerNotificationRequest {
  orderId: string;
  notificationType: 'order_received' | 'status_update';
  newStatus?: string;
}

const statusMessages: Record<string, { title: string; message: string; emoji: string }> = {
  paid: {
    title: "Payment Confirmed",
    message: "Your payment has been received and your order is being processed.",
    emoji: "✅"
  },
  confirmed: {
    title: "Order Confirmed",
    message: "Your order has been confirmed and will be prepared soon.",
    emoji: "📋"
  },
  preparing: {
    title: "Order Being Prepared",
    message: "Great news! We're now preparing your delicious desserts.",
    emoji: "👨‍🍳"
  },
  ready: {
    title: "Ready for Pickup",
    message: "Your order is ready! You can pick it up at the designated location.",
    emoji: "📦"
  },
  processing: {
    title: "Order Processing",
    message: "Your order is being processed for shipping.",
    emoji: "⚙️"
  },
  shipped: {
    title: "Order Shipped",
    message: "Your order is on its way! It will arrive soon.",
    emoji: "🚚"
  },
  delivered: {
    title: "Order Delivered",
    message: "Your order has been delivered. Enjoy your treats!",
    emoji: "🎉"
  },
  completed: {
    title: "Order Completed",
    message: "Your order is complete. Thank you for shopping with us!",
    emoji: "⭐"
  },
  cancelled: {
    title: "Order Cancelled",
    message: "Your order has been cancelled. If you have questions, please contact us.",
    emoji: "❌"
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, notificationType, newStatus }: CustomerNotificationRequest = await req.json();

    if (!orderId) {
      throw new Error("Order ID is required");
    }

    console.log(`Sending ${notificationType} notification for order ${orderId}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch order details
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

    // Build order items HTML
    const itemsHtml = order.order_items
      .map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.products.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">€${Number(item.price_at_purchase).toFixed(2)}</td>
        </tr>
      `)
      .join("");

    const shippingAddress = order.shipping_address as any;
    
    const deliveryInfoHtml = order.delivery_type === 'pickup' 
      ? `
        <div style="margin: 20px 0; background-color: #f0f9ff; padding: 15px; border-radius: 8px;">
          <h3 style="color: #0369a1; margin-top: 0;">📍 Pickup Details</h3>
          <p><strong>Location:</strong> ${order.pickup_locations?.name || 'N/A'}</p>
          <p><strong>Address:</strong> ${order.pickup_locations?.address || ''}, ${order.pickup_locations?.city || ''}</p>
          ${order.pickup_date ? `<p><strong>Date:</strong> ${order.pickup_date}</p>` : ''}
          ${order.pickup_time ? `<p><strong>Time:</strong> ${order.pickup_time}</p>` : ''}
        </div>
      `
      : `
        <div style="margin: 20px 0; background-color: #f0f9ff; padding: 15px; border-radius: 8px;">
          <h3 style="color: #0369a1; margin-top: 0;">🚚 Shipping Details</h3>
          <p><strong>Address:</strong> ${shippingAddress?.address || 'N/A'}, ${shippingAddress?.city || ''}</p>
        </div>
      `;

    let subject: string;
    let headerHtml: string;
    const status = newStatus || order.status;
    const statusInfo = statusMessages[status] || { title: "Order Update", message: "Your order status has been updated.", emoji: "📬" };

    if (notificationType === 'order_received') {
      subject = `Order Confirmed! #${order.id.slice(0, 8)}`;
      headerHtml = `
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Order Received!</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Thank you for your order, ${order.user_name}!</p>
        </div>
      `;
    } else {
      subject = `${statusInfo.emoji} Order Update: ${statusInfo.title} - #${order.id.slice(0, 8)}`;
      headerHtml = `
        <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${statusInfo.emoji} ${statusInfo.title}</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">${statusInfo.message}</p>
        </div>
      `;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        ${headerHtml}
        
        <div style="padding: 30px;">
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0;"><strong>Order ID:</strong> #${order.id.slice(0, 8)}</p>
            <p style="margin: 5px 0 0;"><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
            <p style="margin: 5px 0 0;"><strong>Current Status:</strong> <span style="background-color: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${status.toUpperCase()}</span></p>
          </div>

          ${deliveryInfoHtml}

          <h3 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Your Order</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: #f9fafb;">
                <td colspan="2" style="padding: 12px; text-align: right;">Total:</td>
                <td style="padding: 12px; text-align: right; color: #059669; font-size: 18px;">€${Number(order.total_amount).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px;">
            <p style="margin: 0; color: #92400e;">
              <strong>Questions?</strong> Reply to this email or contact our support team.
            </p>
          </div>
        </div>

        <div style="background-color: #f3f4f6; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">
            Thank you for choosing ZeroCals! 🍰
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "ZeroCals <onboarding@resend.dev>",
      to: [order.user_email],
      subject,
      html: emailHtml,
    });

    console.log("Customer notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending customer notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
