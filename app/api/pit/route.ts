import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  };

  if (
    !result.summary &&
    result.warnings.length === 0 &&
    result.optimizedPlan.length === 0 &&
    result.bookingSuggestions.length === 0
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

  if (spots.length > 0 && dayCount > 0 && spots.length > dayCount * 3) {
    warnings.push("你排的景點偏多，這趟行程很可能會太趕，轉場與排隊時間容易被低估。");
  }

  if (spots.some((spot) => /羅浮宮|louvre/i.test(spot)) && dayCount <= 1) {
    warnings.push("如果有羅浮宮，通常不要只抓很短時間，很多人實際去了之後都覺得半天不夠。");
  }

  if (spots.some((spot) => /迪士尼|disney/i.test(spot)) && companion.includes("家庭")) {
    warnings.push("親子行程不要把熱門樂園和太多移動排在同一天，體力和排隊時間都容易失控。");
  }

  if (companion.includes("長輩")) {
    warnings.push("有長輩同行時，建議保留更多休息與交通緩衝，不要把一天排太滿。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆行程，建議每天主景點 1–2 個就好，不要塞太多順路景點。");
  }

  if (warnings.length === 0) {
    warnings.push("目前看起來沒有特別明顯的爆雷點，但還是建議提前確認熱門景點的停留時間與預約需求。");
  }

  optimizedPlan.push(`先把 ${destination} 的景點分成「必去」與「可刪」兩層，避免全部硬塞在同一天。`);

  if (dayCount > 0) {
    optimizedPlan.push(`以 ${dayCount} 天來看，建議每天只安排 1–2 個主要景點，再搭配附近散步、購物或用餐。`);
  } else {
    optimizedPlan.push("建議先確認實際停留天數，這會直接影響動線是否合理。");
  }

  if (spots.length > 0) {
    optimizedPlan.push(`優先把同區域的點排在一起，例如：${spots.slice(0, 2).join(" / ")}，不要反覆跨區來回。`);
  } else {
    optimizedPlan.push(`如果還沒決定景點，可以先從 ${destination} 最核心的區域開始排，再慢慢補次要景點。`);
  }

  if (companion.includes("家庭")) {
    optimizedPlan.push("親子行程建議加上午休、提早晚餐或保留回飯店休息時間。");
  }

  if (companion.includes("長輩")) {
    optimizedPlan.push("長輩同行建議減少換車次數，必要時優先考慮包車或接送。");
  }

  bookingSuggestions.push("熱門景點門票");
  bookingSuggestions.push("機場接送 / 市區接送");
  bookingSuggestions.push("一日遊 / 導覽行程");

  if (companion.includes("家庭")) {
    bookingSuggestions.push("親子友善體驗或快速入場產品");
  }

  return {
    summary: `${destination} 這趟行程可以成行，但建議先處理動線、停留時間與是否需要提前預約，這樣整體體驗會順很多。`,
    warnings,
    optimizedPlan,
    bookingSuggestions,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;

    const destination = cleanString(body.destination);
    const days = cleanString(body.days);
    const spots = Array.isArray(body.spots)
      ? body.spots.map((s) => cleanString(s)).filter(Boolean)
      : [];
    const companion = cleanString(body.companion);
    const style = cleanString(body.style);

    if (!destination) {
      return NextResponse.json(
        { error: "destination is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY in environment variables");
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    const prompt = `
你是一位專業旅遊規劃顧問，專門做三件事：
1. 幫旅客找出行程中的踩坑風險
2. 優化成更合理的旅遊安排
3. 提出可直接預約的商品方向

請根據以下資訊回答：

目的地：${destination}
天數：${days || "未指定"}
想去景點：${spots.join("、") || "未指定，請依目的地自動建議"}
同行類型：${companion || "未指定"}
偏好節奏：${style || "未指定"}

請只回傳 JSON，不要加任何額外說明，不要使用 markdown code block。
格式必須完全如下：

{
  "summary": "用 2 到 3 句繁體中文總結這趟行程的主要風險與建議",
  "warnings": [
    "3 到 5 條具體避坑提醒"
  ],
  "optimizedPlan": [
    "4 到 6 條具體行程優化建議"
  ],
  "bookingSuggestions": [
    "3 到 5 個適合直接預約的項目，例如：熱門景點門票、機場接送、導覽、一日遊、包車"
  ]
}

要求：
- 一律用繁體中文
- 要具體，不要空泛
- 避坑提醒要像真正懂旅遊的人會說的
- 如果使用者沒有提供景點，就依目的地與天數主動提出合理建議
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: prompt,
    });

    const text = response.output_text?.trim() || "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("OpenAI returned non-JSON text:", text);
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    const normalized = normalizeAIResult(parsed);
    if (!normalized) {
      return NextResponse.json(
        buildFallbackResult({ destination, days, spots, companion, style }),
        { status: 200 }
      );
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("API /api/plan error:", error);

    return NextResponse.json(
      {
        error: "AI planning failed",
      },
      { status: 500 }
    );
  }
}