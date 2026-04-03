export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

type RequestBody = {
  destination?: string;
  days?: string | number;
  spots?: string[];
  companion?: string;
  style?: string;
};

type AIPlanResult = {
  summary: string;
  warnings: string[];
  optimizedPlan: string[];
  bookingSuggestions: string[];
  dailyPlan?: string[];
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function normalizeAIResult(input: unknown): AIPlanResult | null {
  if (!input || typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  const result: AIPlanResult = {
    summary: cleanString(obj.summary),
    warnings: cleanArray(obj.warnings),
    optimizedPlan: cleanArray(obj.optimizedPlan),
    bookingSuggestions: cleanArray(obj.bookingSuggestions),
    dailyPlan: cleanArray(obj.dailyPlan),
  };

  if (
    !result.summary &&
    result.warnings.length === 0 &&
    result.optimizedPlan.length === 0 &&
    result.bookingSuggestions.length === 0 &&
    (!result.dailyPlan || result.dailyPlan.length === 0)
  ) {
    return null;
  }

  return result;
}

function buildFallbackResult(params: {
  destination: string;
  days: string;
  spots: string[];
  companion: string;
  style: string;
}): AIPlanResult {
  const { destination, days, spots, companion, style } = params;
  const dayCount = Number(days || 0);

  const warnings: string[] = [];
  const optimizedPlan: string[] = [];
  const bookingSuggestions: string[] = [];
  const dailyPlan: string[] = [];

  if (spots.length > 0 && dayCount > 0 && spots.length > dayCount * 3) {
    warnings.push("你現在塞的景點偏多，真實走起來很可能會太趕，移動與排隊時間會比想像中更長。");
  }

  if (companion.includes("家庭")) {
    warnings.push("家庭親子行程不要把熱門景點排太滿，吃飯、休息與臨時狀況都需要額外緩衝。");
  }

  if (companion.includes("長輩")) {
    warnings.push("長輩同行時，轉車次數太多會很消耗體力，建議優先減少跨區移動。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你想走輕鬆型節奏，就不適合一天塞太多『順便去一下』的點。");
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有明顯爆雷，但仍建議先確認熱門景點停留時間與是否需要提前預約。");
  }

  optimizedPlan.push(`先把 ${destination} 的景點分成「必去」與「可刪」，不要一開始就全部硬塞。`);
  optimizedPlan.push(`以 ${days || "這次"} 的天數來看，建議每天 1–2 個主景點，再搭配附近散步、購物或吃飯。`);

  if (spots.length > 0) {
    optimizedPlan.push(`同區域景點應排在同一天，例如：${spots.slice(0, 2).join(" / ")} 這類不要來回跨區。`);
  }

  bookingSuggestions.push("熱門景點門票");
  bookingSuggestions.push("機場接送 / 市區接送");
  bookingSuggestions.push("一日遊 / 當地導覽");

  if (companion.includes("家庭")) {
    bookingSuggestions.push("親子友善體驗 / 快速入場");
  }

  const safeDayCount = dayCount > 0 ? dayCount : 3;
  for (let i = 1; i <= Math.min(safeDayCount, 5); i++) {
    dailyPlan.push(`Day ${i}：安排 1–2 個核心景點，避免跨區來回，下午保留用餐與休息緩衝。`);
  }

  return {
    summary: `${destination} 這趟不是不能去，而是目前安排還不夠像真正能走的行程。建議先處理動線、節奏與預約項目，體驗會差很多。`,
    warnings,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
  };
}

export async function POST(req: Request) {
  let destination = "";
  let days = "";
  let spots: string[] = [];
  let companion = "";
  let style = "";

  try {
    const body = (await req.json()) as RequestBody;

    destination = cleanString(body.destination);
    days = cleanString(body.days);
    spots = Array.isArray(body.spots)
      ? body.spots.map((s) => cleanString(s)).filter(Boolean)
      : [];
    companion = cleanString(body.companion);
    style = cleanString(body.style);

    if (!destination) {
      return NextResponse.json(
        { error: "destination is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY in environment variables");
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `
你不是一般摘要機器，你是一位真的很會排自由行的資深旅遊顧問。
你的任務不是講空話，而是幫使用者把原本很模糊、很容易踩坑的想法，整理成真正可執行的旅行安排。

你的回答風格要求：
1. 要像真的懂旅遊的人，不要像客服話術
2. 要明確指出哪裡不合理
3. 要給出實際可走的安排
4. 要有取捨，不要每個地方都說可以去
5. 要像在幫朋友規劃，不要講太空泛

你只能輸出 JSON。
你只能使用繁體中文。
不要輸出 markdown，不要輸出多餘說明。
`;

    const userPrompt = `
請根據以下資訊，幫我做真正有用的旅遊規劃：

目的地：${destination}
天數：${days || "未指定"}
想去景點：${spots.join("、") || "未指定，請你主動幫我規劃"}
同行類型：${companion || "未指定"}
偏好節奏：${style || "未指定"}

請輸出 JSON，格式如下：

{
  "summary": "用 2 到 4 句繁體中文，直接說出這趟行程目前最大的問題、節奏感、值不值得這樣排",
  "warnings": [
    "3 到 5 條具體避坑提醒，要真的指出哪裡會後悔"
  ],
  "optimizedPlan": [
    "4 到 6 條具體優化建議，要有取捨與排序邏輯"
  ],
  "dailyPlan": [
    "Day 1：實際安排",
    "Day 2：實際安排",
    "Day 3：實際安排"
  ],
  "bookingSuggestions": [
    "3 到 5 個最值得先預約的項目"
  ]
}

規則：
- 不能只講『每天 1-2 個景點』這種太空泛的句子
- 要具體說明怎麼排比較合理
- 若使用者沒有提供景點，就主動規劃該城市最合理的初次旅行版本
- 若行程太空，請主動補強
- 若行程太滿，請主動刪減
- 若適合先訂票、接送、導覽、包車，要明確提出
- dailyPlan 一定要真的像可以拿去執行的版本
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      console.error("OpenAI returned empty content");
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[0] : text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("OpenAI returned invalid JSON text:", text);
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    const normalized = normalizeAIResult(parsed);

    if (!normalized) {
      console.error("normalizeAIResult failed:", parsed);
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    console.error("API /api/pit fatal error:", error);

    return NextResponse.json(
      buildFallbackResult({ destination, days, spots, companion, style }),
      { status: 200 }
    );
  }
}