export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";

type BookingCandidate = {
  id?: number;
  title?: string;
  place_name?: string | null;
  description?: string | null;
  category?: string | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  href?: string;
  sourceLabel?: string | null;
  image?: string | null;
};

type RequestBody = {
  destination?: string;
  days?: string | number;
  spots?: string[];
  companion?: string;
  style?: string;
  budget?: string;
  mustAvoid?: string;
  bookingCandidates?: BookingCandidate[];
};

type BookingSuggestion = {
  title: string;
  reason: string;
  href: string;
  buttonLabel: string;
  badge: string;
  sourceLabel?: string;
  image?: string;
  priceFrom?: string;
  duration?: string;
  tag?: string;
};

type AIPlanResult = {
  summary?: string;
  warnings: string[];
  strategy: string[];
  optimizedPlan: string[];
  bookingSuggestions: BookingSuggestion[];
  dailyPlan: string[];
  content?: string;
};

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function cleanArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanString(item)).filter(Boolean);
}

function normalizeBookingSuggestions(value: unknown): BookingSuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;

      const title = cleanString(obj.title);
      const reason = cleanString(obj.reason);
      const href = cleanString(obj.href);
      const buttonLabel = cleanString(obj.buttonLabel) || "查看";
      const badge = cleanString(obj.badge) || "推薦";
      const sourceLabel = cleanString(obj.sourceLabel) || undefined;
      const image = cleanString(obj.image) || undefined;
      const priceFrom = cleanString(obj.priceFrom) || undefined;
      const duration = cleanString(obj.duration) || undefined;
      const tag = cleanString(obj.tag) || undefined;

      if (!title || !reason || !href) return null;

      return {
        title,
        reason,
        href,
        buttonLabel,
        badge,
        sourceLabel,
        image,
        priceFrom,
        duration,
        tag,
      };
    })
    .filter(Boolean) as BookingSuggestion[];
}

function normalizeAIResult(input: unknown): AIPlanResult | null {
  if (!input || typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  const result: AIPlanResult = {
    summary: cleanString(obj.summary) || undefined,
    warnings: cleanArray(obj.warnings),
    strategy: cleanArray(obj.strategy),
    optimizedPlan: cleanArray(obj.optimizedPlan),
    bookingSuggestions: normalizeBookingSuggestions(obj.bookingSuggestions),
    dailyPlan: cleanArray(obj.dailyPlan),
    content: cleanString(obj.content) || undefined,
  };

  if (
    !result.summary &&
    result.warnings.length === 0 &&
    result.strategy.length === 0 &&
    result.optimizedPlan.length === 0 &&
    result.bookingSuggestions.length === 0 &&
    result.dailyPlan.length === 0 &&
    !result.content
  ) {
    return null;
  }

  return result;
}

function buildFallbackBookingSuggestions(candidates: BookingCandidate[]): BookingSuggestion[] {
  return candidates.slice(0, 4).map((item, index) => ({
    title: cleanString(item.place_name) || cleanString(item.title) || `候選方案 ${index + 1}`,
    reason:
      index === 0
        ? "這個最值得先看，因為它最可能影響整趟行程主線。"
        : "這個可以當成後續候選方案。",
    href: cleanString(item.href) || "/",
    buttonLabel: "查看",
    badge: index === 0 ? "優先" : "候選",
    sourceLabel:
      cleanString(item.sourceLabel) ||
      cleanString(item.city) ||
      cleanString(item.country) ||
      undefined,
    image: cleanString(item.image) || undefined,
    priceFrom: "查看方案",
    duration: "依方案為準",
    tag: index === 0 ? "AI 建議" : "參考",
  }));
}

function buildFallbackResult(params: {
  destination: string;
  days: string;
  spots: string[];
  companion: string;
  style: string;
  budget: string;
  mustAvoid: string;
  bookingCandidates: BookingCandidate[];
}): AIPlanResult {
  const { destination, days, spots, companion, style, mustAvoid, bookingCandidates } = params;

  const dayCount = Math.max(1, Math.min(Number(days || 3), 7));
  const warnings: string[] = [];
  const strategy: string[] = [];
  const optimizedPlan: string[] = [];
  const dailyPlan: string[] = [];

  if (spots.length > 0 && spots.length > dayCount * 3) {
    warnings.push("你排的景點偏多，這趟行程很容易因為移動與排隊時間而失控。");
  }

  if (spots.some((spot) => /迪士尼|disney/i.test(spot)) && companion.includes("家庭")) {
    warnings.push("親子行程不要把熱門樂園和太多跨區移動塞同一天。");
  }

  if (companion.includes("長輩")) {
    warnings.push("有長輩同行時，建議保留更多休息和交通緩衝。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆行程，就不適合一天塞太多『順便去一下』的點。");
  }

  if (mustAvoid) {
    warnings.push(`既然你最不想踩的是「${mustAvoid}」，那整體安排就不應該往太滿、太散的方向走。`);
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有非常明顯的大雷，但還是建議先固定每天主區域與熱門預約項目。");
  }

  strategy.push(`這趟 ${destination} 的關鍵不是去更多地方，而是每天都順。`);
  strategy.push("先定每天主區域，再補咖啡、購物、散步和餐廳。");
  strategy.push("先鎖熱門票券 / 接送 / 一日遊，再決定小行程。");

  optimizedPlan.push(`先把 ${destination} 的景點分成「一定要去」和「有空再去」。`);
  optimizedPlan.push(`以 ${dayCount} 天來看，每天 1 個主區域 + 1 到 2 個核心點最合理。`);
  optimizedPlan.push("上午排最重要的點，下午排同區散步、購物或休息。");
  optimizedPlan.push("不要晚餐後再大幅跨區，晚上收在同一區通常最舒服。");

  for (let i = 0; i < dayCount; i++) {
    if (i === 0) {
      dailyPlan.push(`Day ${i + 1}：抵達後先排同區輕鬆行程，不要第一天就排最硬的景點。`);
    } else if (i === dayCount - 1) {
      dailyPlan.push(`Day ${i + 1}：安排一個主要區域 + 收尾購物 / 散步，避免最後一天折返。`);
    } else {
      dailyPlan.push(
        `Day ${i + 1}：上午主景點，下午同區散步 / 咖啡 / 購物，晚餐不要再換太遠的區域。`
      );
    }
  }

  return {
    summary: `${destination} 這趟可以成行，但重點不是塞更多地方，而是先把動線、節奏和該先預約的東西理順。`,
    warnings,
    strategy,
    optimizedPlan,
    bookingSuggestions: buildFallbackBookingSuggestions(bookingCandidates),
    dailyPlan,
    content: [
      `如果我是直接幫你排 ${destination}，我不會先追求去更多地方，而是先確保每天都有節奏。`,
      "先把主區域固定，再決定細項；先把主線商品鎖定，再補支線內容。",
      "",
      "真正讓旅行變順的，通常不是更多景點，而是更好的取捨。",
    ].join("\n"),
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
    const budget = cleanString(body.budget);
    const mustAvoid = cleanString(body.mustAvoid);
    const bookingCandidates = Array.isArray(body.bookingCandidates) ? body.bookingCandidates : [];

    if (!destination) {
      return NextResponse.json({ error: "destination is required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        buildFallbackResult({
          destination,
          days,
          spots,
          companion,
          style,
          budget,
          mustAvoid,
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

    const client = new OpenAI({ apiKey });

    const candidateText =
      bookingCandidates.length > 0
        ? bookingCandidates
            .slice(0, 8)
            .map((item, index) => {
              const title = cleanString(item.place_name) || cleanString(item.title);
              const desc = cleanString(item.description);
              const href = cleanString(item.href);
              const source =
                cleanString(item.sourceLabel) ||
                cleanString(item.city) ||
                cleanString(item.country) ||
                "";
              return `${index + 1}. 標題：${title}｜說明：${desc}｜來源：${source}｜連結：${href}`;
            })
            .join("\n")
        : "目前沒有提供可用候選方案";

    const prompt = `
你是一位真的懂旅遊節奏與消費取捨的 AI 顧問，不是制式行程機器。

你的任務：
1. 先指出風險與容易後悔的地方
2. 提供真正有判斷的策略與優化方向
3. 排出簡潔可行的 Day by Day
4. 從候選方案中挑出值得先看的項目

使用者資料：
- 目的地 / 主題：${destination}
- 天數：${days || "未指定"}
- 想去景點：${spots.join("、") || "未指定"}
- 同行類型：${companion || "未指定"}
- 偏好節奏：${style || "未指定"}
- 預算方向：${budget || "未指定"}
- 最不想踩的坑：${mustAvoid || "未指定"}

候選方案資料：
${candidateText}

請只回傳 JSON，不要加任何額外說明，不要使用 markdown code block。
格式必須完全如下：

{
  "summary": "2 到 3 句繁體中文總評，口吻像真的旅遊顧問，有判斷，不要空泛",
  "warnings": [
    "3 到 5 條具體避坑提醒"
  ],
  "strategy": [
    "3 到 5 條整體策略"
  ],
  "optimizedPlan": [
    "4 到 6 條具體優化建議"
  ],
  "bookingSuggestions": [
    {
      "title": "方案名稱",
      "reason": "為什麼值得先看",
      "href": "可直接點擊的網址",
      "buttonLabel": "查看",
      "badge": "優先/候選/門票/接送/包車/體驗 其中之一或類似短字",
      "sourceLabel": "來源名稱",
      "image": "",
      "priceFrom": "查看方案",
      "duration": "依方案為準",
      "tag": "AI 建議"
    }
  ],
  "dailyPlan": [
    "Day 1：......",
    "Day 2：......"
  ],
  "content": "用 5 到 10 句繁體中文，像真人顧問一樣完整講清楚判斷與取捨"
}

規則：
- 一律繁體中文
- 不要空話
- 如果候選方案不足，bookingSuggestions 可以是空陣列
- href 必須是有效字串；如果沒有候選方案就不要亂編
- dailyPlan 要根據天數輸出
`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text = response.output_text?.trim() || "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        buildFallbackResult({
          destination,
          days,
          spots,
          companion,
          style,
          budget,
          mustAvoid,
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

    const normalized = normalizeAIResult(parsed);

    if (!normalized) {
      return NextResponse.json(
        buildFallbackResult({
          destination,
          days,
          spots,
          companion,
          style,
          budget,
          mustAvoid,
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("API /api/pit error:", error);

    return NextResponse.json(
      {
        error: "AI planning failed",
      },
      { status: 500 }
    );
  }
}