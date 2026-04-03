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
  dailyPlan: string[];
  content: string;
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
    content: cleanString(obj.content),
  };

  if (
    !result.summary &&
    result.warnings.length === 0 &&
    result.optimizedPlan.length === 0 &&
    result.bookingSuggestions.length === 0 &&
    result.dailyPlan.length === 0 &&
    !result.content
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
    warnings.push("你現在塞的景點偏多，真實走起來很可能會太趕，尤其是移動、排隊與吃飯時間會比想像中更長。");
  }

  if (spots.some((spot) => /羅浮宮|louvre/i.test(spot)) && dayCount <= 1) {
    warnings.push("如果有羅浮宮，通常不要只抓很短時間，很多人實際去了之後都會覺得半天根本不夠。");
  }

  if (spots.some((spot) => /迪士尼|disney/i.test(spot)) && companion.includes("家庭")) {
    warnings.push("家庭親子行程不要把熱門景點排太滿，吃飯、休息、排隊與臨時狀況都需要額外緩衝。");
  }

  if (companion.includes("長輩")) {
    warnings.push("有長輩同行時，轉車次數太多會很消耗體力，建議優先減少跨區移動。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆型節奏，就不適合一天塞太多『順便去一下』的點。");
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有特別明顯的爆雷，但還是建議先確認熱門景點停留時間與預約需求。");
  }

  optimizedPlan.push(`先把 ${destination} 的景點分成「必去」與「可刪」，不要一開始就全部硬塞。`);
  optimizedPlan.push(`以 ${days || "這次"} 的天數來看，建議每天 1–2 個主景點，再搭配附近散步、購物或吃飯。`);

  if (spots.length > 0) {
    optimizedPlan.push(`同區域景點應排在同一天，例如：${spots.slice(0, 2).join(" / ")} 這類不要來回跨區。`);
  } else {
    optimizedPlan.push(`如果你還沒決定景點，先從 ${destination} 最核心的區域開始排，再補次要景點。`);
  }

  if (companion.includes("家庭")) {
    optimizedPlan.push("親子行程建議加入午休、提早晚餐或回飯店休息的空檔。");
  }

  if (companion.includes("長輩")) {
    optimizedPlan.push("長輩同行建議優先考慮接送、包車或少換乘的路線。");
  }

  bookingSuggestions.push("熱門景點門票");
  bookingSuggestions.push("機場接送 / 市區接送");
  bookingSuggestions.push("一日遊 / 當地導覽");

  if (companion.includes("家庭")) {
    bookingSuggestions.push("親子友善體驗 / 快速入場");
  }

  const safeDayCount = Math.max(1, Math.min(dayCount || 3, 6));
  for (let i = 1; i <= safeDayCount; i++) {
    dailyPlan.push(`Day ${i}：安排 1–2 個核心景點，避免跨區來回，下午保留用餐與休息緩衝。`);
  }

  const content = [
    `這趟 ${destination} 行程不是不能玩，而是目前比較像「想去清單」，還不像真正能舒服執行的旅行版本。`,
    `我會建議你先把節奏放慢，把最想去的點留下，把只是順便的點刪掉，整體體驗會好很多。`,
    "",
    "你現在最該注意的是：",
    "• 不要一天塞太多主景點",
    "• 同區域景點放同一天",
    "• 熱門景點與移動時間要留緩衝",
    "",
    "如果你要走比較有感覺的版本，這趟行程最好至少有一餐、一次散步、一次完全不趕時間的空檔。",
  ].join("\n");

  return {
    summary: `${destination} 這趟不是不能去，而是目前安排還不夠像真正能走的行程。建議先處理動線、節奏與預約項目，體驗會差很多。`,
    warnings,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
    content,
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
你是一位非常厲害的自由行旅遊顧問，
專門幫人優化行程、避免踩坑、提升旅行體驗。

你的風格：
- 像真人，而不是客服
- 會做取捨，不是什麼都說可以
- 會指出不合理的地方
- 會幫使用者重新規劃
- 會像真的在幫朋友排自由行

你只能輸出 JSON。
你只能使用繁體中文。
不要輸出 markdown code block，不要輸出多餘說明。
`;

    const userPrompt = `
幫我優化這個旅遊行程：

地點：${destination}
天數：${days || "未指定"}
景點：${spots.join("、") || "幫我安排"}
同行：${companion || "未指定"}
風格：${style || "未指定"}

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
  ],
  "content": "請用比較像真人旅遊顧問的方式，寫出完整建議。要有節奏、有判斷、有取捨，不要只是空泛列點。"
}

規則：
- 不能只講「每天 1-2 個景點」這種太空泛的句子
- 要具體說明怎麼排比較合理
- 若使用者沒有提供景點，就主動規劃該城市最合理的初次旅行版本
- 若行程太空，請主動補強
- 若行程太滿，請主動刪減
- 若適合先訂票、接送、導覽、包車，要明確提出
- dailyPlan 一定要真的像可以拿去執行的版本
- content 要像資深旅遊顧問在跟朋友講話，不要像機器
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.8,
      response_format: { type: "json_object" },
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
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