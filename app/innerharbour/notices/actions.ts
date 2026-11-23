"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseAdminNoticeForm } from "@/lib/api/systemNotices";
import { requireAdminPage } from "@/lib/opsPage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function backWith(params: Record<string, string>): never {
  const qs = new URLSearchParams(params).toString();
  redirect(`/innerharbour/notices${qs ? `?${qs}` : ""}`);
}

export async function saveSystemNoticeAction(formData: FormData): Promise<void> {
  const { userId, svc } = await requireAdminPage({ write: true }, "/innerharbour/notices");
  const parsed = parseAdminNoticeForm(formData);
  if (!parsed.ok) {
    backWith({ err: parsed.error });
  }
  const idRaw = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
  const nowIso = new Date().toISOString();

  if (idRaw && UUID_RE.test(idRaw)) {
    const { error } = await svc
      .from("system_notices")
      .update({ ...parsed.data, updated_at: nowIso })
      .eq("id", idRaw);
    if (error !== null) {
      backWith({ err: `更新失敗：${error.message}`, edit: idRaw });
    }
    revalidatePath("/innerharbour/notices");
    backWith({ ok: "已更新系統消息" });
  } else {
    const { error } = await svc.from("system_notices").insert({
      ...parsed.data,
      created_by: userId,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (error !== null) {
      backWith({ err: `建立失敗：${error.message}` });
    }
    revalidatePath("/innerharbour/notices");
    backWith({ ok: parsed.data.published ? "已建立並發佈系統消息" : "已儲存為草稿" });
  }
}

export async function toggleSystemNoticeAction(formData: FormData): Promise<void> {
  const { svc } = await requireAdminPage({ write: true }, "/innerharbour/notices");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
  const next = formData.get("next_published") === "true";
  if (!UUID_RE.test(id)) backWith({ err: "無效的公告 ID" });

  const { error } = await svc
    .from("system_notices")
    .update({ published: next, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error !== null) {
    backWith({ err: `狀態切換失敗：${error.message}` });
  }
  revalidatePath("/innerharbour/notices");
  backWith({ ok: next ? "已發佈上線" : "已下架為草稿" });
}

export async function deleteSystemNoticeAction(formData: FormData): Promise<void> {
  const { svc } = await requireAdminPage({ write: true }, "/innerharbour/notices");
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")).trim() : "";
  if (!UUID_RE.test(id)) backWith({ err: "無效的公告 ID" });

  const { error } = await svc.from("system_notices").delete().eq("id", id);
  if (error !== null) {
    backWith({ err: `刪除失敗：${error.message}` });
  }
  revalidatePath("/innerharbour/notices");
  backWith({ ok: "已刪除該條系統消息" });
}
