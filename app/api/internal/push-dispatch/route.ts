import { createServiceClient } from "@/lib/supabase/server";
import { dispatchNativePush } from "@/lib/push/outbox";
import { isDispatchAuthorized, pushDispatchSecret } from "@/lib/push/outboxPolicy";

export const runtime = "nodejs";
export const maxDuration = 60;
/** Supabase pg_cron/pg_net calls this with a server-only dedicated push secret from Vault, never an app token. */
export async function POST(req: Request): Promise<Response> {
 if(!isDispatchAuthorized(req.headers.get("authorization"),pushDispatchSecret(process.env)))return Response.json({error:"unauthorized"},{status:401});
 try{return Response.json(await dispatchNativePush(await createServiceClient()));}
 catch{return Response.json({error:"push-dispatch-unavailable"},{status:503});}
}
