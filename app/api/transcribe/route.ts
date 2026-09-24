import { NextResponse } from "next/server";
import {
  transcribePcm16k,
  type IflytekAccent,
} from "@/lib/iflytek";

/**
 * UR2.3 transcription endpoint. Accepts a 16k mono WAV (base64, converted
 * client-side by lib/audio.ts), tries Cantonese → Mandarin → English and
 * returns the first non-empty transcript. Secrets never leave the server.
 */
export async function POST(req: Request) {
  const { appId, apiKey, apiSecret } = {
    appId: process.env.IFLYTEK_APP_ID ?? "",
    apiKey: process.env.IFLYTEK_API_KEY ?? "",
    apiSecret: process.env.IFLYTEK_API_SECRET ?? "",
  };
  if (!appId || !apiKey || !apiSecret) {
    return NextResponse.json(
      { code: "missing-keys", message: "Transcription is not configured." },
      { status: 500 },
    );
  }

  let body: { audioBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "bad-request", message: "Expected JSON with audioBase64." },
      { status: 400 },
    );
  }
  if (!body.audioBase64 || body.audioBase64.length > 6_000_000) {
    return NextResponse.json(
      { code: "bad-audio", message: "Missing or oversized audio." },
      { status: 400 },
    );
  }

  let wav: Buffer;
  try {
    wav = Buffer.from(body.audioBase64, "base64");
  } catch {
    return NextResponse.json(
      { code: "bad-audio", message: "audioBase64 is not valid base64." },
      { status: 400 },
    );
  }
  // Strip the 44-byte WAV header iFlytek doesn't want.
  const pcm = wav.length > 44 ? wav.subarray(44) : wav;
  if (pcm.length === 0) {
    return NextResponse.json(
      { code: "bad-audio", message: "Empty audio." },
      { status: 400 },
    );
  }

  const creds = { appId, apiKey, apiSecret };
  const order: IflytekAccent[] = ["cantonese", "mandarin", "english"];
  for (const accent of order) {
    try {
      const text = (await transcribePcm16k(creds, pcm, accent)).trim();
      if (text) return NextResponse.json({ text, accent });
    } catch (err) {
      // Auth/billing errors fail fast; recognition empties fall through.
      const msg = err instanceof Error ? err.message : "";
      if (/ASR error \[(101|102|103|104|105|106|107|108|109|110)\]/.test(msg)) {
        return NextResponse.json(
          { code: "provider-error", message: msg },
          { status: 502 },
        );
      }
    }
  }
  return NextResponse.json({ text: "", accent: null });
}
