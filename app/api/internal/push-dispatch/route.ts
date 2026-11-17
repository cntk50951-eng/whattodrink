import { createServiceClient } from "@/lib/supabase/server";
import { dispatchNativePush } from "@/lib/push/outbox";
import { isDispatchAuthorized } from "@/lib/push/outboxPolicy";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Supabase pg_cron/pg_net calls this with a server-only Vault secret, never an app token. */
export async function POST(req: Request): Promise<Response> {
 if(!isDispatchAuthorized(req.headers.get("authorization"),process.env.CRON_SECRET))return Response.json({error:"unauthorized"},{status:401});
 try{return Response.json(await dispatchNativePush(await createServiceClient()));}
 catch{return Response.json({error:"push-dispatch-unavailable"},{status:503});}
}
