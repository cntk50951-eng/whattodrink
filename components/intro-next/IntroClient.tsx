"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

import type { AppLocale } from "@/i18n/routing";

import type { IntroBasePath } from "./copy";
import s from "./intro-next.module.css";

// Remotion uses matchMedia and animation frames, so it stays in the browser.
const IntroPlayer = dynamic(() => import("./IntroPlayer"), {
  ssr: false,
  loading: () => <div className={s.root}><div className={s.loading}>WhatToDrink</div></div>,
});

export function IntroClient({ locale, basePath = "intro-next" }: { locale: AppLocale; basePath?: IntroBasePath }): ReactElement {
  return <IntroPlayer locale={locale} basePath={basePath} />;
}
