"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

import { cityIconSrc, type CityCode } from "@/lib/city";

type CityIconProps = {
  code: CityCode | null;
  size?: number;
};

/**
 * UR3.5+ 左上卡片的城市图形：有码即按需加载对应 SVG，
 * 无码／加载失败回退 Building2（不断头，不断网也成立）。
 */
export function CityIcon({ code, size = 26 }: CityIconProps) {
  const [failed, setFailed] = useState(false);
  if (code === null || failed) return <Building2 size={size} />;
  return (
    // next/image 默认跳过 SVG 优化——1KB 矢量用 <img> 零损失，少一层开销。
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cityIconSrc(code)}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
