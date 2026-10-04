"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { avatarPublicUrl, BIO_MAX, type ProfileGender } from "@/lib/api/profile";
import styles from "./v2.module.css";

export type ProfileInitial = {
  gender: "male" | "female" | "secret";
  avatarUrl: string | null;
  dob: string | null;
  bio: string | null;
};

/**
 * UR E.18 資料表單（v2-only；首登＋個人面板複用同一張）。
 * onboard 模式：性別二選一必填＋生日必填（缺即提交 disabled）；跳過即打戳。
 * profile 模式：四段全可改＋保存（樂觀 toast，失敗回滾留現場）。
 * 頭像：點選上傳（image/*）→簽名直傳 avatars 桶（沿 chat 圖口徑）→回填公開 URL。
 */
export function OnboardingSheet({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "onboard" | "profile";
  initial: ProfileInitial;
  onClose: () => void;
  /** 保存成功（新 profile 行；调用方刷 me＋关）。 */
  onSaved: () => void;
}) {
  const t2 = useTranslations("v2");
  const [gender, setGender] = useState<ProfileGender | null>(
    initial.gender === "male" || initial.gender === "female" ? initial.gender : null,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [dob, setDob] = useState(initial.dob ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const valid = gender !== null && /^\d{4}-\d{2}-\d{2}$/.test(dob);
  const canSubmit = mode === "profile" ? !saving && !uploading : valid && !saving && !uploading;

  const pickAvatar = async (file: File): Promise<void> => {
    if (uploading) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const allow = ["jpg", "jpeg", "png", "webp"];
    if (!allow.includes(ext) || !file.type.startsWith("image/")) {
      setBanner(t2("avatarBadType"));
      return;
    }
    setUploading(true);
    setBanner(null);
    try {
      const signRes = await fetch("/api/v1/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ purpose: "avatar", ext, bytes: file.size }),
      });
      const signJson = (await signRes.json().catch(() => null)) as {
        bucket?: unknown;
        path?: unknown;
        uploadUrl?: unknown;
      } | null;
      if (
        !signRes.ok ||
        typeof signJson?.bucket !== "string" ||
        typeof signJson?.path !== "string" ||
        typeof signJson?.uploadUrl !== "string"
      ) {
        throw new Error("sign");
      }
      const putRes = await fetch(signJson.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("upload");
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      if (base === "") throw new Error("env");
      setAvatarUrl(avatarPublicUrl(base, signJson.bucket, signJson.path));
    } catch {
      setBanner(t2("avatarBadType"));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (skip: boolean): Promise<void> => {
    if (saving || uploading) return;
    if (!skip && (gender === null || !/^\d{4}-\d{2}-\d{2}$/.test(dob))) return;
    setSaving(true);
    setBanner(null);
    try {
      const body: Record<string, unknown> = skip
        ? { onboarded: true }
        : {
            gender,
            dob,
            bio: bio.trim() === "" ? null : bio.trim().slice(0, BIO_MAX),
            avatar_url: avatarUrl,
            onboarded: mode === "onboard",
          };
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // UR E.19：未成年硬拒（422 明文；不打戳不关单，留现场改生日）。
        const j = (await res.json().catch(() => null)) as {
          error?: { code?: unknown; message?: unknown };
        } | null;
        if (res.status === 422 || j?.error?.code === "AGE_RESTRICTED") {
          setBanner(t2("ageRestricted"));
          return;
        }
        throw new Error("save");
      }
      onSaved();
      onClose();
    } catch {
      setBanner(t2("profileSaveFail"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className={`${styles.v2scope} max-h-[85svh] gap-4 overflow-y-auto rounded-t-2xl p-4 sm:mx-auto sm:w-full sm:max-w-md`}
      >
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="text-left">
          <SheetTitle>{mode === "onboard" ? t2("onboardTitle") : t2("profileTitle")}</SheetTitle>
          {mode === "onboard" && <SheetDescription>{t2("onboardDesc")}</SheetDescription>}
        </SheetHeader>
        {banner !== null && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
            {banner}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">
            {t2("onboardGender")} <span aria-hidden className="text-destructive">*</span>
          </p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t2("onboardGender")}>
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={gender === g}
                onClick={() => setGender(g)}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 p-3 text-sm font-bold ${
                  gender === g ? "border-primary bg-primary/[0.08] text-primary" : "text-muted-foreground"
                }`}
              >
                <span aria-hidden>{g === "male" ? "♂" : "♀"}</span>
                {t2(g === "male" ? "genderMale" : "genderFemale")}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">{t2("onboardAvatar")}</p>
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {avatarUrl !== null ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={20} className="text-muted-foreground" />
              )}
            </span>
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "…" : t2("onboardAvatarPick")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              aria-hidden
              tabIndex={-1}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f !== undefined) void pickAvatar(f);
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">
            {t2("onboardDob")} {mode === "onboard" && <span aria-hidden className="text-destructive">*</span>}
          </p>
          <Input
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDob(e.target.value)}
            aria-label={t2("onboardDob")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">{t2("onboardBio")}</p>
          <textarea
            rows={2}
            maxLength={BIO_MAX}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={t2("onboardBioPh")}
            aria-label={t2("onboardBioPh")}
            className="max-h-24 min-h-14 w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {mode === "onboard" && (
            <Button variant="ghost" onClick={() => void submit(true)} disabled={saving} className="flex-1 rounded-full">
              {t2("onboardSkip")}
            </Button>
          )}
          <Button onClick={() => void submit(false)} disabled={!canSubmit} className="flex-1 rounded-full font-bold">
            {saving ? "…" : mode === "onboard" ? t2("onboardDone") : t2("profileSave")}
            {!saving && <Check size={15} aria-hidden />}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
