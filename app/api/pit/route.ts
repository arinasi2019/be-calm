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
  summary: string;
  warnings: string[];
  strategy: string[];
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
        image: cleanString(obj.image) || null,
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
    summary: cleanString(obj.summary),
    warnings: cleanArray(obj.warnings),
    strategy: cleanArray(obj.strategy),
    optimizedPlan: cleanArray(obj.optimizedPlan),
    bookingSuggestions: normalizeBookingSuggestions(obj.bookingSuggestions),
    dailyPlan: cleanArray(obj.dailyPlan),
    content: cleanString(obj.content),
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
  const {
    destination,
    days,
    spots,
    companion,
    style,
    budget,
    mustAvoid,
    bookingCandidates,
  } = params;

  const dayCount = Number(days || 0);
  const warnings: string[] = [];
  const strategy: string[] = [];
  const optimizedPlan: string[] = [];
  const dailyPlan: string[] = [];
  const bookingSuggestions: BookingSuggestion[] = [];

  if (spots.length > 0 && dayCount > 0 && spots.length > dayCount * 3) {
    warnings.push("你目前想去的點偏多，最大的風險不是玩不到，而是整趟一直在趕路。");
  }

  if (!spots.length) {
    warnings.push("你目前沒有列景點，最容易踩的坑會變成到當地才臨時想，最後花很多時間在移動和決定。");
  }

  if (companion.includes("家庭")) {
    warnings.push("親子行程最怕把熱門景點、購物和跨區移動塞在同一天，實際上很容易崩。");
  }

  if (companion.includes("長輩")) {
    warnings.push("長輩同行的痛點通常不是景點本身，而是換車、找路、來回折返。");
  }

  if (style.includes("輕鬆")) {
    warnings.push("你偏好輕鬆型節奏，就不適合一天塞太多『順便去一下』的點。");
  }

  if (mustAvoid) {
    warnings.push(`你自己已經明確說不想要「${mustAvoid}」，所以安排應該圍繞這個限制來做。`);
  }

  if (warnings.length === 0) {
    warnings.push("目前沒有超明顯的大雷，但還是建議先把每天主區域和預約順序定清楚。");
  }

  strategy.push(`這趟 ${destination} 不要追求去很多地方，而要追求每天都順。`);
  strategy.push("先定每天主區域，再決定要不要補購物、咖啡店或夜景。");
  strategy.push("真正該先鎖的不是所有景點，而是熱門門票、接送和移動骨架。");

  optimizedPlan.push(`先把 ${destination} 的安排拆成「一定要」和「有空再去」，不要一開始就全部塞滿。`);
  optimizedPlan.push(`以 ${days || "這次"} 的天數來看，每天以 1 個主區域 + 1 到 2 個核心重點最合理。`);
  optimizedPlan.push("上午排最難排隊或最需要體力的點，下午改成散步、購物或咖啡。");

  if (budget) {
    optimizedPlan.push(`因為你有提到預算方向「${budget}」，所以不建議把高單價體驗全塞在同一兩天。`);
  }

  if (spots.length > 0) {
    optimizedPlan.push(`你現在列的點，建議先照地理位置分天，例如：${spots.slice(0, 3).join(" / ")}。`);
  } else {
    optimizedPlan.push(`如果你要我先幫你起一版，建議從 ${destination} 最經典、最順路的區域先排。`);
  }

  const safeDayCount = Math.max(1, Math.min(dayCount || 3, 6));
  for (let i = 1; i <= safeDayCount; i++) {
    if (i === 1) {
      dailyPlan.push(`Day ${i}：抵達日只安排同區域輕鬆行程，先熟悉環境，不要第一天就排硬仗。`);
    } else if (i === safeDayCount) {
      dailyPlan.push(`Day ${i}：安排一個主要區域＋收尾購物或散步，避免最後一天做高風險跨區移動。`);
    } else {
      dailyPlan.push(`Day ${i}：上午主景點，下午同區散步 / 咖啡 / 購物，晚餐不要再跨區。`);
    }
  }

  bookingSuggestions.push(
    ...bookingCandidates.slice(0, 4).map((item, index) => ({
      title: item.place_name || item.title,
      reason:
        index === 0
          ? "這個最適合先鎖定，能先把你整趟行程的主線定下來。"
          : "這個適合當成候選預約項目，等主線排好後再加入。",
      href: item.href || "#",
      buttonLabel: "查看方案",
      badge: index === 0 ? "優先預約" : "體驗",
      sourceLabel: item.sourceLabel || item.city || item.country || undefined,
      image: item.image || undefined,
      priceFrom: index === 0 ? "查看方案" : "待查看",
      duration: index === 0 ? "半日 / 一日" : "依方案為準",
      tag: index === 0 ? "AI 推薦" : "候選方案",
    }))
  );

  return {
    summary: `${destination} 這趟不是不能玩，而是你目前比較像在列願望清單，還不是一份真正走起來舒服的版本。先把每天主區域、節奏和該先訂的東西定下來，整體體驗會差很多。`,
    warnings,
    strategy,
    optimizedPlan,
    bookingSuggestions,
    dailyPlan,
    content: [
      `如果我是直接幫你排這趟 ${destination}，我不會先追求去很多地方，而是先確保每天都順。`,
      `你現在最需要處理的不是「還能不能再多加一個景點」，而是把每天主題區域先固定。`,
      "",
      "我會建議你這樣想：",
      "1. 先定每天主區域",
      "2. 先鎖最值得預約的門票 / 接送 / 體驗",
      "3. 剩下的空檔再加散步、購物、咖啡店",
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
  let budget = "";
  let mustAvoid = "";
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
    budget = cleanString(body.budget);
    mustAvoid = cleanString(body.mustAvoid);
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
            .slice(0, 12)
            .map((item, idx) =>
              [
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
                `image: ${item.image || ""}`,
              ].join("\n")
            )
            .join("\n\n")
        : "目前沒有可直接導購的候選項目。";

    const systemPrompt = `
你是一位高階 AI 旅遊專員。
你不是客服，也不是只會列點的摘要機器。

你的任務：
1. 判斷這個行程哪裡不合理
2. 重整成真正能玩的版本
3. 幫使用者抓出節奏、取捨、預約順序
4. 從候選商品中挑出最適合先買的項目

風格要求：
- 像資深自由行顧問
- 有判斷、有取捨
- 不要什麼都說可以
- 不要空泛
- dailyPlan 要真的可執行
- content 要像在跟朋友講，而不是機器

你只能輸出合法 JSON。
你只能使用繁體中文。
不要輸出 markdown code block。
`;

    const userPrompt = `
請幫我做一份有質感的 AI 旅遊專員規劃。

【使用者需求】
地點：${destination}
天數：${days || "未指定"}
景點：${spots.join("、") || "尚未指定，請主動規劃"}
同行：${companion || "未指定"}
偏好節奏：${style || "未指定"}
預算方向：${budget || "未指定"}
不想踩的坑：${mustAvoid || "未指定"}

【可直接導購 / 可直接預約的候選項目】
${candidateText}

請輸出 JSON：

{
  "summary": "2到4句，像顧問直接講重點",
  "warnings": ["3到5條具體避坑提醒"],
  "strategy": ["3到5條整體策略判斷"],
  "optimizedPlan": ["4到6條具體優化方向"],
  "dailyPlan": [
    "Day 1：具體安排",
    "Day 2：具體安排"
  ],
  "bookingSuggestions": [
    {
      "title": "具體推薦項目名稱",
      "reason": "為什麼現在該先買",
      "href": "只能從候選項目裡挑",
      "buttonLabel": "查看方案",
      "badge": "例如：門票 / 接送 / 包車 / 體驗 / 優先預約",
      "sourceLabel": "可用 place_name 或 sourceLabel",
      "image": "若候選有 image 就優先帶入，沒有可留空字串",
      "priceFrom": "用簡短字串，例如：¥3,500起 / 查看方案 / 依頁面為準",
      "duration": "用簡短字串，例如：3小時 / 半日 / 一日 / 依方案為準",
      "tag": "例如：AI 推薦 / 親子適合 / 先鎖主線 / 熱門"
    }
  ],
  "content": "像資深旅遊顧問在幫朋友排旅程，完整講出這趟應該怎麼玩、怎麼刪、怎麼留白、哪些該先訂"
}

規則：
- bookingSuggestions 最多 4 個
- href 只能從我提供的候選項目裡挑
- image 若候選有就優先沿用
- priceFrom 與 duration 可用保守描述，不要亂編過度具體假資訊
- 候選項目不夠適合時可以少給，不要硬湊
- 沒有景點時要主動規劃第一次去最順的版本
- 太空時主動補強
- 太滿時主動刪減
- dailyPlan 不能空泛
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
          budget,
          mustAvoid,
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
        budget,
        mustAvoid,
        bookingCandidates,
      }),
      { status: 200 }
    );
  }
}