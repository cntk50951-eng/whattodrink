import { useCallback, useEffect, useRef, useState } from "react";

/**
 * UR2.5 真实摇动检测（devicemotion）。
 *
 * - 回调走 ref（UR1.6 教训：闭包过期读到旧状态），触发后按 `cooldownMs` 冷却。
 * - 判定：含重力加速度的帧间跃变量连续两次超阈值（防单次颠簸误触）。
 * - iOS 13+ 要 `DeviceMotionEvent.requestPermission()` 且必须在用户手势里调 ——
 *   hook 只在 granted 后挂监听；调用方（摇摇按钮 onClick）里调 requestPermission。
 * - SSR 安全：一切 window 访问都在 effect／回调里。
 */

export type ShakePermission = "unknown" | "granted" | "denied";

/** 单帧跃变阈值（m/s² 量级，手机正常走路约 2–4，猛摇 15+）。 */
const SHAKE_JERK = 12;
/** 两次有效跃变的最大间隔，超过算两次独立事件（要连贯的摇）。 */
const SHAKE_PAIR_MS = 600;

type DeviceMotionWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function needsPermission(): boolean {
  if (typeof window === "undefined") return false;
  const DME = window.DeviceMotionEvent as
    | DeviceMotionWithPermission
    | undefined;
  return typeof DME?.requestPermission === "function";
}

export function useShake(
  onShake: () => void,
  cooldownMs: number = 3000,
  /**
   * UR2.9 prime：第一晃的确认（按钮 tick＋轻震），让物理摇动手感不断档。
   * 可选，冷却期内不触发。
   */
  onPrime?: () => void,
): {
  supported: boolean;
  needsPermission: boolean;
  permission: ShakePermission;
  requestPermission: () => Promise<boolean>;
} {
  const [permission, setPermission] = useState<ShakePermission>("unknown");
  const cbRef = useRef(onShake);
  const primeRef = useRef(onPrime);
  // 每 render 同步最新回调（effect 里写 ref，render 里只读）。
  useEffect(() => {
    cbRef.current = onShake;
    primeRef.current = onPrime;
  });
  const needPerm = needsPermission();
  const supported =
    typeof window !== "undefined" && "DeviceMotionEvent" in window;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!needPerm) {
      setPermission("granted");
      return true;
    }
    try {
      const DME = window.DeviceMotionEvent as DeviceMotionWithPermission;
      const result = await DME.requestPermission?.();
      const ok = result === "granted";
      setPermission(ok ? "granted" : "denied");
      return ok;
    } catch {
      setPermission("denied");
      return false;
    }
  }, [needPerm]);

  useEffect(() => {
    // 要权限的等 granted 才挂；不要权限的直接挂。
    if (!supported || (needPerm && permission !== "granted")) return;
    let last: { x: number; y: number; z: number; t: number } | null = null;
    let firstJerkAt = 0;
    let coolingUntil = 0;
    const onMotion = (e: DeviceMotionEvent): void => {
      const a = e.accelerationIncludingGravity;
      if (a === null || a.x === null || a.y === null || a.z === null) return;
      const t = Date.now();
      if (last !== null) {
        const jerk =
          Math.abs(a.x - last.x) + Math.abs(a.y - last.y) + Math.abs(a.z - last.z);
        if (jerk > SHAKE_JERK) {
          if (t - firstJerkAt < SHAKE_PAIR_MS && t >= coolingUntil) {
            coolingUntil = t + cooldownMs;
            firstJerkAt = 0;
            cbRef.current();
          } else {
            firstJerkAt = t;
            if (t >= coolingUntil) primeRef.current?.();
          }
        }
      }
      last = { x: a.x, y: a.y, z: a.z, t };
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [supported, needPerm, permission, cooldownMs]);

  return { supported, needsPermission: needPerm, permission, requestPermission };
}
