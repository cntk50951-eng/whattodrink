import { createServiceClient, getAuthedClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/envelope";
import { parseCheckinIdParam } from "@/lib/api/checkins";

/**
 * UR E.7 留言刪除（🔒 需登入：本人或帖作者）。
 * `DELETE /api/v1/comments/:id` -> `{deleted:true}`。
 * 匿名留言無 session，自刪無門——只剩帖作者可刪（防騷擾口徑）。
 * 他人刪一律 404，不洩歸屬。刪 comment 行（硬刪；帖删已級聯）。
 */

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: rawId } = await ctx.params;
  const idParsed = parseCheckinIdParam(rawId);
  if ("error" in idParsed) {
    return apiError("invalid_params", idParsed.error, 400);
  }
  const authed = await getAuthedClient();
  if (authed.userId === null) {
    return apiError("unauthorized", "未登录", 401);
  }
  const userId = authed.userId;

  try {
    const service = await createServiceClient();
    const { data: comment, error: cErr } = await service
      .from("checkin_comments")
      .select("id,checkin_id,user_id")
      .eq("id", idParsed.id)
      .maybeSingle();
    if (cErr) {
      console.error(
        `[api/v1/comments-delete] lookup error: code=${cErr.code} message=${cErr.message}`,
      );
      return apiError("internal", "留言读取失败", 500);
    }
    if (comment === null) {
      return apiError("not_found", "留言不存在", 404);
    }
    const row = comment as { id: string; checkin_id: string; user_id: string | null };

    // 帖作者可刪該帖任何留言：先取帖歸屬。
    let isPostAuthor = false;
    if (row.user_id !== userId) {
      const { data: post, error: pErr } = await service
        .from("checkins")
        .select("user_id")
        .eq("id", row.checkin_id)
        .maybeSingle();
      if (pErr) {
        console.error(
          `[api/v1/comments-delete] post lookup error: code=${pErr.code} message=${pErr.message}`,
        );
        return apiError("internal", "帖子读取失败", 500);
      }
      isPostAuthor =
        post !== null && (post as { user_id: string | null }).user_id === userId;
      if (!isPostAuthor) {
        return apiError("not_found", "留言不存在", 404);
      }
    }
    const { error: dErr } = await service
      .from("checkin_comments")
      .delete()
      .eq("id", idParsed.id);
    if (dErr) {
      console.error(
        `[api/v1/comments-delete] delete error: code=${dErr.code} message=${dErr.message}`,
      );
      return apiError("internal", "留言刪除失敗", 500);
    }
    return apiOk({ deleted: true });
  } catch (err) {
    console.error(
      `[api/v1/comments-delete] unexpected: ${err instanceof Error ? err.message : err}`,
    );
    return apiError("internal", "留言刪除失敗", 500);
  }
}
