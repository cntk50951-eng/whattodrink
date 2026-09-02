import {
  Camera,
  GlassWater,
  MapPin,
  Users,
} from "lucide-react";
import { Hero } from "@/components/marketing/sections/hero";
import { HowItWorks } from "@/components/marketing/sections/how-it-works";
import { Features } from "@/components/marketing/sections/features";
import { CommunityPreview } from "@/components/marketing/sections/community-preview";
import { CtaBanner } from "@/components/marketing/sections/cta";

/**
 * Marketing landing — anonymous visitor entry point.
 *
 * NOTE: content here is **placeholder** per user's instruction
 * (`.harness/workflow.md` step 1). Copy will be filled in once the user
 * provides detailed requirements in PRODUCT_BACKLOG.md.
 *
 * Layout intent (UR 1.0):
 *  - mobile  → single column, generous vertical rhythm
 *  - desktop → wider containers, multi-column feature grids
 */
export default function MarketingHome() {
  return (
    <>
      <Hero
        eyebrow="今晚喝咩"
        title="讓天意決定你今晚喝什麼"
        description="把選擇交給心情、運氣或朋友。Whattodrink 結合 AI 推薦、拍照選酒與香港本地酒吧資料庫，陪你度過每一個值得喝一杯的時刻。"
        primaryCta={{ label: "讓天意決定", href: "/tonight" }}
        secondaryCta={{ label: "瀏覽酒吧", href: "/bars" }}
      />

      <HowItWorks
        eyebrow="怎麼運作"
        title="三步，開喝"
        steps={[
          {
            number: "01",
            title: "選擇觸發條件",
            description:
              "隨機搖骰、輸入心情、上傳酒櫃照片，或讓朋友投票 — 4 種方式讓天意做主。",
          },
          {
            number: "02",
            title: "喝下去",
            description:
              "看推薦結果，決定要不要聽天意。也支援查看成分與食物搭配。",
          },
          {
            number: "03",
            title: "記錄心情",
            description:
              "為這杯酒留下一個 emoji + 一句話，累積成你的飲酒日誌與回憶。",
          },
        ]}
      />

      <Features
        eyebrow="核心功能"
        title="不只是隨機抽酒"
        features={[
          {
            title: "AI 推薦",
            description:
              "輸入心情或上傳食物照片，讓模型推薦最適合的那一杯。",
            icon: <GlassWater />,
          },
          {
            title: "拍照選酒",
            description:
              "在便利店、酒櫃前拍張照，自動辨識並推薦最合適的喝法。",
            icon: <Camera />,
          },
          {
            title: "本地酒吧",
            description:
              "整合香港本地酒吧資料與 Google Places，找到最近的好去處。",
            icon: <MapPin />,
          },
          {
            title: "多人酒桌遊戲",
            description:
              "朋友聚會時的助興小遊戲，誰付錢、誰先乾杯，交給命運決定。",
            icon: <Users />,
          },
        ]}
      />

      <CommunityPreview
        eyebrow="社區"
        title="別人在喝什麼"
        description="（待接入真實資料）以下為示意內容，展示日後心情流的格式。"
        entries={[]}
      />

      <CtaBanner
        eyebrow="準備好了嗎"
        title="今晚，就讓天意決定"
        description="免費使用，無需註冊即可開始。"
        primaryCta={{ label: "立即開始", href: "/tonight" }}
        secondaryCta={{ label: "了解更多", href: "/about" }}
      />
    </>
  );
}
