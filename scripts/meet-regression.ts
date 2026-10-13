/**
 * 遇見 prompt 回歸探針（手動觸發，不進 CI）。
 * 用法：MINIMAX_KEY=... npx vite-node scripts/meet-regression.ts
 * 逐条把 fixtures 发给线上 MiniMax，对比 criteria 是否退化（人工看 diff）。
 * fixtures 来自 iOS 探针结论（WEB_HANDOFF_MEET_AI_QUALITY）。
 */
import { minimaxChat } from "../lib/minimax";
import { meetParsePrompt, sanitizeCriteria } from "../lib/meet";

const CASES: { input: string; expect: string }[] = [
  { input: "我想找一個女生", expect: '{"gender":"female"}，无其他' },
  { input: "30 歲左右嘅女仔", expect: "age 27–33" },
  { input: "鍾意拉格啤酒嘅人", expect: "taste_keys 含 lager" },
  { input: "我想找一個女生，喜歡喝酒", expect: "只有 gender，不给 interests/taste" },
  { input: "想搵人一齊睇波，唔介意男定女", expect: "interests 含 ball_sports，无 gender" },
  { input: "二十幾歲、識講廣東話嘅女仔", expect: "age 20–29＋languages yue" },
  { input: "喺中環附近、而家喺線", expect: "nearby_km＋online_only" },
  { input: "愛威士忌、懂廣東話、30 歲左右嘅女仔", expect: "age 27–33（非精确 30），ignored 不含已翻条件" },
];

async function main(): Promise<void> {
  const key = process.env.MINIMAX_KEY ?? "";
  if (key === "") {
    console.error("MINIMAX_KEY 缺失");
    process.exit(1);
  }
  for (const c of CASES) {
    const reply = await minimaxChat(
      [
        { role: "system", content: meetParsePrompt().system },
        { role: "user", content: c.input },
      ],
      { apiKey: key, temperature: 0, topP: 1 },
    );
    let parsed: unknown = null;
    try {
      const s = reply.indexOf("{");
      const e = reply.lastIndexOf("}");
      parsed = s !== -1 && e > s ? sanitizeCriteria((JSON.parse(reply.slice(s, e + 1)) as Record<string, unknown>).criteria) : { parse: "FAIL" };
    } catch {
      parsed = { parse: "FAIL" };
    }
    console.log(`\n### ${c.input}\n期望：${c.expect}\n实际：${JSON.stringify(parsed)}`);
  }
}

void main();
