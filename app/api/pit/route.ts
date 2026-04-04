export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import OpenAI from "openai";

type BookingCandidate = {
  id: number | string;
  title: string;
  place_name?: string | null;
  description?: string | null;
  category?: string | null;
  country?: string | null;
  city?: string | null;
  location?: string | null;
  href?: string | null;
  sourceLabel?: string | null;
};

type RequestBody = {
  destination?: string;
  days?: string | number;
  spots?: string[];
  companion?: string;
  style?: string;
  bookingCandidates?: BookingCandidate[];
};

type BookingSuggestion = {
  title: string;
  reason: string;
  href: string;
  buttonLabel: string;
  badge: string;
  sourceLabel?: string;
};

type AIPlanResult = {
  summary: string;
  warnings: string[];
  optimizedPlan: string[];
  bookingSuggestions: BookingSuggestion[];
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

function cleanBookingCandidates(value: unknown): BookingCandidate[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;

      const href = cleanString(obj.href);
      if (!href) return null;

      return {
        id: cleanString(obj.id),
        title: cleanString(obj.title),
        place_name: cleanString(obj.place_name) || null,
        description: cleanString(obj.description) || null,
        category: cleanString(obj.category) || null,
        country: cleanString(obj.country) || null,
        city: cleanString(obj.city) || null,
        location: cleanString(obj.location) || null,
        href,
        sourceLabel: cleanString(obj.sourceLabel) || null,
      };
    })
    .filter(Boolean) as BookingCandidate[];
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
      const buttonLabel = cleanString(obj.buttonLabel) || "查看方案";
      const badge = cleanString(obj.badge) || "推薦";
      const sourceLabel = cleanString(obj.sourceLabel) || undefined;

      if (!title || !reason || !href) return null;

      return {
        title,
        reason,
        href,
        buttonLabel,
        badge,
        sourceLabel,
      };
    })
    .filter(Boolean) as BookingSuggestion[];
}

function normalizeAIResult(input: unknown): AIPlanResult | null {
  if (!input || typeof input !== "object") return null;

  const obj = input as Record<string, unknown>;

  const result: AIPlanResult = {
    summary: cleanString(obj.summary),
    warnings: cleanArray(obj.warnings),
    optimizedPlan: cleanArray(obj.optimizedPlan),
    bookingSuggestions: normalizeBookingSuggestions(obj.bookingSuggestions),
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
  bookingCandidates: BookingCandidate[];
}): AIPlanResult {
  const { destination, days, spots, companion, style, bookingCandidates } = params;

  const dayCount = Number(days || 0);
  const warnings: string[] = [];
  const optimizedPlan: string[] = [];
  const dailyPlan: string[] = [];
  const bookingSuggestions: BookingSuggestion[] = [];

  if (spots.length > 0 && dayCount > 0 && spots.length > dayCount * 3) {
    warnings.push("你現在想去的點偏多，真實走起來很容易因為排隊、吃飯、轉場而整體失控。");
  }

  if (!spots.length) {
    warnings.push("你目前還沒有列景點，代表最容易踩的坑不是太滿，而是到當地才臨時決定，最後浪費很多移動時間。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆節奏，就不適合一天塞太多『順路再去一下』的安排。");
  }

  if (companion.includes("家庭")) {
    warnings.push("親子行程不要把熱門景點、購物、長距離移動排在同一天，小朋友通常不是卡在體力，就是卡在吃飯與休息。");
  }

  if (companion.includes("長輩")) {
    warnings.push("有長輩同行時，真正會累的不是景點本身，而是轉車、找路、反覆上下交通工具。");
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有超明顯的大雷，但還是建議先把每天的主題區域排清楚，避免來回折返。");
  }

  optimizedPlan.push(`先把 ${destination} 的安排分成「一定要去」和「有空再去」，不要一開始就全部塞滿。`);
  optimizedPlan.push(`以 ${days || "這次"} 的天數來看，每天以 1 個主區域 + 1 到 2 個重點景點最合理。`);
  optimizedPlan.push("上午排需要體力或需要預約的點，下午安排散步、購物、咖啡店或彈性空檔。");

  if (spots.length > 0) {
    optimizedPlan.push(`你現在列的景點裡，建議把同區域的點排同一天，例如：${spots.slice(0, 3).join(" / ")} 先看地理位置再決定順序。`);
  } else {
    optimizedPlan.push(`如果你要我先幫你起一版，建議先從 ${destination} 最經典、最順路的區域下手，不要一開始就排太多跨區移動。`);
  }

  const safeDayCount = Math.max(1, Math.min(dayCount || 3, 6));
  for (let i = 1; i <= safeDayCount; i++) {
    if (i === 1) {
      dailyPlan.push(`Day ${i}：抵達後只安排同區域的輕鬆行程，先熟悉動線，不要第一天就硬塞大景點。`);
    } else if (i === safeDayCount) {
      dailyPlan.push(`Day ${i}：安排一個主要區域 + 保留收尾與購物彈性，不要在最後一天做高風險跨區移動。`);
    } else {
      dailyPlan.push(`Day ${i}：上午主景點，下午附近散步 / 咖啡 / 購物，晚餐安排在同區，不要來回折返。`);
    }
  }

  const fallbackCards = bookingCandidates.slice(0, 4).map((item, index) => ({
    title: item.place_name || item.title,
    reason:
      index === 0
        ? "這個項目最適合先鎖定，能幫你把主要行程先確定下來。"
        : "這個可以當成你行程裡的候選預約項目，等主線排好後再決定是否加入。",
    href: item.href || "#",
    buttonLabel: "查看方案",
    badge: index === 0 ? "優先預約" : "候選方案",
    sourceLabel: item.sourceLabel || item.city || item.country || undefined,
  }));

  bookingSuggestions.push(...fallbackCards);

  return {
    summary: `${destination} 這趟不是不能玩，而是你現在比較像在列願望清單，還不是一份真正走起來舒服的旅行版本。先把每天主區域、節奏和該先訂的東西定下來，整體體驗會好很多。`,
    warnings,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
    content: [
      `如果我是直接幫你排這趟 ${destination}，我不會先追求去很多地方，而是先確保每一天走起來是順的。`,
      `你現在最需要處理的不是「還能不能再多加一個景點」，而是把每天的主題和區域先固定，這樣整趟旅行才不會一直在移動。`,
      "",
      "我建議你的排序思路是：",
      "1. 先定每天主要區域",
      "2. 先鎖最值得預約的票券 / 接送 / 體驗",
      "3. 剩下的空檔再加咖啡店、購物、散步",
      "",
      "真正好玩的自由行，不是排最滿，而是每天都剛剛好。",
    ].join("\n"),
  };
}

export async function POST(req: Request) {
  let destination = "";
  let days = "";
  let spots: string[] = [];
  let companion = "";
  let style = "";
  let bookingCandidates: BookingCandidate[] = [];

  try {
    const body = (await req.json()) as RequestBody;

    destination = cleanString(body.destination);
    days = cleanString(body.days);
    spots = Array.isArray(body.spots)
      ? body.spots.map((s) => cleanString(s)).filter(Boolean)
      : [];
    companion = cleanString(body.companion);
    style = cleanString(body.style);
    bookingCandidates = cleanBookingCandidates(body.bookingCandidates);

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
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

    const client = new OpenAI({ apiKey });

    const candidateText =
      bookingCandidates.length > 0
        ? bookingCandidates
            .slice(0, 12)
            .map((item, idx) => {
              return [
                `候選 ${idx + 1}`,
                `title: ${item.title}`,
                `place_name: ${item.place_name || ""}`,
                `description: ${item.description || ""}`,
                `category: ${item.category || ""}`,
                `country: ${item.country || ""}`,
                `city: ${item.city || ""}`,
                `location: ${item.location || ""}`,
                `href: ${item.href || ""}`,
                `sourceLabel: ${item.sourceLabel || ""}`,
              ].join("\n");
            })
            .join("\n\n")
        : "目前沒有可直接導購的候選商品。";

    const systemPrompt = `
你是一位很強的自由行旅遊顧問。
你不是客服，也不是資料朗讀器。
你的工作是：
1. 幫使用者判斷這個行程哪裡不合理
2. 重新整理成真正能玩的版本
3. 從提供的候選商品中，挑出最適合先預約的項目

風格要求：
- 講人話，像真的懂自由行的人
- 要有判斷、有取捨
- 不要什麼都說可以
- 不要空泛
- 不能只重複「每天 1-2 個景點」
- dailyPlan 要像真的可執行
- content 要像資深旅遊顧問在幫朋友排

你只能輸出合法 JSON。
你只能使用繁體中文。
不要輸出 markdown code block。
`;

    const userPrompt = `
請幫我做一份真的有內容的 AI 行程規劃。

【使用者需求】
地點：${destination}
天數：${days || "未指定"}
景點：${spots.join("、") || "尚未指定，請主動幫我規劃"}
同行：${companion || "未指定"}
偏好節奏：${style || "未指定"}

【可直接導購 / 可直接預約的候選項目】
${candidateText}

請輸出以下 JSON 格式：

{
  "summary": "2到4句，直接說這趟現在最大的問題、適合怎麼玩、值不值得照原本那樣排",
  "warnings": [
    "3到5條具體避坑提醒"
  ],
  "optimizedPlan": [
    "4到6條具體優化建議，要有順序與取捨"
  ],
  "dailyPlan": [
    "Day 1：具體版本",
    "Day 2：具體版本"
  ],
  "bookingSuggestions": [
    {
      "title": "具體推薦項目名稱",
      "reason": "為什麼現在該先訂這個，要跟行程有關",
      "href": "必須從候選項目的 href 裡挑一個，不能亂編",
      "buttonLabel": "查看方案",
      "badge": "例如：優先預約 / 門票 / 接送 / 體驗 / 包車",
      "sourceLabel": "可用 place_name 或 sourceLabel"
    }
  ],
  "content": "像資深旅遊顧問在跟朋友說話，完整講出你真正會怎麼排、怎麼刪、怎麼留白、哪些該先訂"
}

規則：
- bookingSuggestions 最多 4 個
- bookingSuggestions 的 href 只能從我提供的候選項目裡選
- 如果候選項目不夠適合，可以少給，不要硬湊
- 若使用者沒給景點，你要主動規劃該城市第一次去最順的版本
- 若使用者行程太空，要主動補強
- 若行程太滿，要主動刪減
- dailyPlan 一定要具體，不要只有大方向
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      return NextResponse.json(
        buildFallbackResult({
          destination,
          days,
          spots,
          companion,
          style,
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

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
          bookingCandidates,
        }),
        { status: 200 }
      );
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    console.error("API /api/pit fatal error:", error);

    return NextResponse.json(
      buildFallbackResult({
        destination,
        days,
        spots,
        companion,
        style,
        bookingCandidates,
      }),
      { status: 200 }
    );
  }
}