import { NextRequest } from "next/server";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
//   apiVersion: "2025-12-15.clover",
// });
// const webhookSecret = process.env.STRIPE_WEBHOOK_ENDPOINT_SECRET as string;

export async function POST(_req: NextRequest) {
  // const buf = Buffer.from(await req.arrayBuffer());
  // const sig = req.headers.get("stripe-signature");
  // let stripeEvent;
  // try {
  //   stripeEvent = stripe.webhooks.constructEvent(buf, sig || "", webhookSecret);
  // } catch (err) {
  //   return new Response(
  //     `Webhook Error: ${err instanceof Error ? err.message : err}`,
  //     {
  //       status: 400,
  //     },
  //   );
  // }
  // if ("checkout.session.completed" === stripeEvent.type) {
  //   const session = stripeEvent.data.object as {
  //     client_reference_id: ExternalUserId;
  //   };
  //   prisma.payment.create({
  //     data: {
  //       user: {
  //         connectOrCreate: {
  //           create: {
  //             id: String(session.client_reference_id),
  //           },
  //           where: {
  //             id: String(session.client_reference_id),
  //           },
  //         },
  //       },
  //     },
  //   });
  // }
  // return Response.json({ received: true });
}
