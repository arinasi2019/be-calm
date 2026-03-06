import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const { postId, voterKey } = await req.json()

  const { error } = await supabase
    .from("votes")
    .insert({
      post_id: postId,
      voter_key: voterKey
    })

  if (error) {
    return NextResponse.json({ ok:false })
  }

  return NextResponse.json({ ok:true })
}