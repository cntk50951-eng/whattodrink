"use client";

/**
 * POC 房間漫遊（獨立頁）：Hunyuan 房間 GLB ＋ 第一人稱（拖拽看／WASD 走／
 * 左半屏搖桿＋右半屏視角，手機）。碰撞＝縮小包圍盒夾取＋射線擋牆。
 * 房 89MB→4.84MB；酒保 Ivy 靜態掃描 78MB→1.52MB（減面 12%＋meshopt＋WebP，
 * 無骨骼無動畫，靠程序化點頭／面向玩家／呼吸浮動撐場面）。
 */

import { useEffect, useRef, useState } from "react";
import { Martini, Mic } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import { BARTENDER_NAME } from "@/lib/bartender";
import { buildRecordingBlob, recordingToWavBase64 } from "@/lib/audio";

const EYE = 3.8;
const SPEED = 1.7;
const SCALE_TARGET = 8;
/** 酒保：靜態 GLB 歸一身高＋落位（吧枱內側，背牆面出生點）。 */
const BARTENDER_URL = "/bar-room/bartender.glb";
// 房係娃娃屋比例（凳面 1.31／枱面 0.98／地板 0.54／吊燈 2.79）。
// 用戶要她同行路眼高（3.8）平頭：身高 3.3，頭頂 3.84；佢條柱全空，掂唔到嘢。
const BARTENDER_HEIGHT = 3.3;
const CHAT_RADIUS = 2.2;
const BLOCK_RADIUS = 0.9;

type WalkMode = "walk" | "orbit";

// sys＝系统提示（网络失败等，非台词，灰色居中，与 Ivy 气泡区分）。
type ChatMsg = { id: number; from: "her" | "me" | "sys"; text: string };

export function RoomWalk({ onReady }: { onReady: (ok: boolean, note: string) => void }): React.JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  // 環繞／走路模式（酒保到了以後，環繞即看他， walking 即走過去；見 Grooming）。
  const [mode, setMode] = useState<WalkMode>("walk");
  const modeRef = useRef<WalkMode>("walk");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  // 酒保对话态（three 循环经 stable setter 写入；台词全部来自模型）。
  // 18＋ 闸 session 内记住（lazy init，不经 effect 避 cascading render）。
  const [adult, setAdult] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("bar-adult") === "1";
    } catch {
      return false;
    }
  });
  const [chatOpen, setChatOpen] = useState(false);
  // 进场三幕：霓虹招牌（加载中）→ 门开（模型就绪）→ 卸幕进场。
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (loading) return;
    const t1 = setTimeout(() => setDoorsOpen(true), 300);
    const t2 = setTimeout(() => setEntered(true), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const msgsRef = useRef<ChatMsg[]>([]);
  const idRef = useRef(1);
  const voiceOnRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);
  const pushMsg = (m: Omit<ChatMsg, "id">): number => {
    const id = idRef.current;
    idRef.current += 1;
    const full = { ...m, id };
    msgsRef.current = [...msgsRef.current, full];
    setMsgs(msgsRef.current);
    return id;
  };
  const replaceMsg = (id: number, m: Omit<ChatMsg, "id">): void => {
    msgsRef.current = msgsRef.current.map((x) => (x.id === id ? { ...m, id } : x));
    setMsgs(msgsRef.current);
  };
  const removeMsg = (id: number): void => {
    msgsRef.current = msgsRef.current.filter((x) => x.id !== id);
    setMsgs(msgsRef.current);
  };
  /** 问 Ivy（文字＋事件统一口；history 自动带最近 10 句；失败回 null）。 */
  const askIvy = async (input: { message?: string; event?: string }): Promise<string | null> => {
    try {
      const history = msgsRef.current
        .filter((m) => m.from !== "sys" && m.text !== "…")
        .map(({ from, text }) => ({ from, text }))
        .slice(-10);
      const res = await fetch("/api/v1/bar/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, history }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { text?: string };
      return typeof data.text === "string" && data.text.length > 0 ? data.text : null;
    } catch {
      return null;
    }
  };
  /** 播台词语音（静默失败：有字无声，不挡聊天）。 */
  const playVoice = async (text: string): Promise<void> => {
    if (!voiceOnRef.current) return;
    try {
      const res = await fetch("/api/v1/bar/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current !== null) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const a = new Audio(url);
      audioRef.current = a;
      await a.play().catch(() => {});
    } catch {
      /* 有字无声 */
    }
  };
  const openChat = (): void => {
    setInvite(null);
    setChatOpen(true);
    if (msgsRef.current.length > 0) return;
    const pid = pushMsg({ from: "her", text: "…" });
    void (async () => {
      const line = await askIvy({ event: "greet" });
      if (line === null) {
        replaceMsg(pid, { from: "sys", text: "Ivy 暂时没听清，稍后再试。" });
        return;
      }
      replaceMsg(pid, { from: "her", text: line });
      void playVoice(line);
    })();
  };
  // effect 内调用走 ref（once-effect，不跟随重渲染；赋值走 effect，避 render 期写 ref）。
  const openChatRef = useRef<() => void>(() => {});
  useEffect(() => {
    openChatRef.current = openChat;
  });
  const sendChat = async (): Promise<void> => {
    const text = draft.trim();
    if (text.length === 0 || sending) return;
    setDraft("");
    await sendText(text);
  };
  /** 发文字（打字＋语音转写统一口；history 由 askIvy 自动带）。 */
  const sendText = async (text: string): Promise<void> => {
    const t = text.trim().slice(0, 500);
    if (t.length === 0 || sending) return;
    pushMsg({ from: "me", text: t });
    setSending(true);
    const pid = pushMsg({ from: "her", text: "…" });
    const line = await askIvy({ message: t });
    setSending(false);
    if (line === null) {
      replaceMsg(pid, { from: "sys", text: "Ivy 暂时没听清，稍后再试。" });
      return;
    }
    replaceMsg(pid, { from: "her", text: line });
    void playVoice(line);
  };
  // 按住对讲（先浏览器免费识别：粤→普→英连试；认不出再走服务端讯飞）。
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  type SRBox = {
    cancelled: boolean;
    rec: {
      stop(): void;
    } | null;
  };
  type SRInstance = {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((e: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  };
  /** 单次浏览器识别（不支持／超时／取消即回 null，不抛）。 */
  const webSpeechOnce = (lang: string, box: SRBox, timeoutMs: number): Promise<string | null> =>
    new Promise((resolve) => {
      const SR = (window as unknown as { SpeechRecognition?: new () => SRInstance }).SpeechRecognition
        ?? (window as unknown as { webkitSpeechRecognition?: new () => SRInstance }).webkitSpeechRecognition;
      if (SR === undefined || box.cancelled) {
        resolve(null);
        return;
      }
      let rec: SRInstance;
      try {
        rec = new SR();
      } catch {
        resolve(null);
        return;
      }
      box.rec = rec;
      let settled = false;
      const finish = (v: string | null): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          rec.stop();
        } catch {
          /* 已停 */
        }
        resolve(v);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const t = e.results?.[0]?.[0]?.transcript?.trim() ?? "";
        finish(t.length > 0 ? t : null);
      };
      rec.onerror = () => finish(null);
      rec.onend = () => finish(null);
      try {
        rec.start();
      } catch {
        finish(null);
      }
    });
  const recRef = useRef<{
    stream: MediaStream;
    mr: MediaRecorder;
    chunks: Blob[];
    timer: ReturnType<typeof setInterval>;
    srBox: SRBox;
    srDone: Promise<string | null>;
  } | null>(null);
  const stopRecord = async (send: boolean): Promise<void> => {
    const r = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (r === null) return;
    clearInterval(r.timer);
    // 停掉浏览器识别（松手即停，onend 会把 srDone 结算成 null）。
    r.srBox.cancelled = true;
    try {
      r.srBox.rec?.stop();
    } catch {
      /* 已停 */
    }
    const blob: Blob | null = await new Promise((resolve) => {
      r.mr.onstop = () => {
        try {
          resolve(buildRecordingBlob(r.chunks, r.mr.mimeType));
        } catch {
          resolve(null);
        }
      };
      try {
        r.mr.stop();
      } catch {
        resolve(null);
      }
    });
    r.stream.getTracks().forEach((t) => t.stop());
    if (!send || blob === null) return;
    // 浏览器识别优先（免费）：有字直接用，录音丢掉；没有才走服务端。
    const tip = pushMsg({ from: "sys", text: "正在听写…" });
    try {
      const srText = await Promise.race([
        r.srDone,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (typeof srText === "string" && srText.length > 0) {
        removeMsg(tip);
        await sendText(srText);
        return;
      }
    } catch {
      /* 掉回服务端 */
    }
    // 分段报错（别再用一句“网络问题”糊弄）：转格式／HTTP 状态／真断网分开说。
    let wav: string;
    try {
      wav = await recordingToWavBase64(blob);
    } catch (e) {
      console.error("[bar-voice-in] wav convert failed:", e);
      replaceMsg(tip, { from: "sys", text: "录音转格式失败，换个浏览器再试一次。" });
      return;
    }
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ audioBase64: wav }),
      });
      const data = (await res.json()) as { text?: string; code?: string };
      if (!res.ok) {
        console.error("[bar-voice-in] transcribe status:", res.status, data);
        replaceMsg(tip, { from: "sys", text: `转写服务忙（${res.status}），再试一次。` });
        return;
      }
      if (typeof data.text !== "string" || data.text.trim().length === 0) {
        replaceMsg(tip, { from: "sys", text: "没听清，再按住说一次。" });
        return;
      }
      removeMsg(tip);
      await sendText(data.text);
    } catch (e) {
      console.error("[bar-voice-in] transcribe fetch failed:", e);
      replaceMsg(tip, { from: "sys", text: "网络问题，转写失败。" });
    }
  };
  const startRecord = async (): Promise<void> => {
    if (recording || sending || recRef.current !== null) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const started = Date.now();
      const timer = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        setRecSecs(s);
        if (s >= 30) void stopRecord(true);
      }, 250);
      // 浏览器免费识别与录音并行（按住期间粤→普→英连试；松手即停）。
      const srBox: SRBox = { cancelled: false, rec: null };
      const srDone: Promise<string | null> = (async () => {
        for (const lang of ["yue-HK", "cmn-Hans-CN", "en-US"]) {
          if (srBox.cancelled) return null;
          const t = await webSpeechOnce(lang, srBox, 5000);
          if (t !== null) return t;
        }
        return null;
      })();
      recRef.current = { stream, mr, chunks, timer, srBox, srDone };
      setRecSecs(0);
      setRecording(true);
      mr.start();
    } catch {
      pushMsg({ from: "sys", text: "麦克风没打开，去系统设置里允许后重试。" });
    }
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (mount === null) return;
    let dead = false;
    const W = mount.clientWidth || 390;
    const H = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050308");
    const camera = new THREE.PerspectiveCamera(68, W / H, 0.05, 120);
    scene.add(new THREE.HemisphereLight("#cbb8ff", "#1a0f0a", 0.9));
    const lamp = new THREE.PointLight("#ffd9a0", 30, 30, 1.8);
    lamp.position.set(0, 3.4, 0);
    scene.add(lamp);

    // 狀態：yaw／pitch＋位置（出生門口，面向房心 -z）
    const pos = new THREE.Vector3(0, EYE, 0);
    let yaw = 0;
    let pitch = -0.2;
    // 環繞態（酒保企吧枱後，只能喺客人側扇形搖（±60°），full circle 必穿枱；
    // 自動慢搖＋拖拽＋滾輪／雙指縮放；半徑夾房內防穿牆）
    // 環繞態（她 3.3m 高：半徑收 2.5 框全身，目標放胸口，唔好仰望頭頂）。
    const orbit = {
      theta: Math.PI * 1.5,
      phi: 1.2,
      radius: 2.5,
      maxR: 2.5,
      tx: 0,
      ty: 1.4,
      tz: 0,
      lastTouch: 0,
      dir: 1,
    };
    // 客人側扇形（-x 方向，theta=3π/2 為正中）。
    const THETA_MIN = Math.PI * 1.5 - 1.05;
    const THETA_MAX = Math.PI * 1.5 + 1.05;
    const keys = new Set<string>();
    // 房間包圍盒（載入後回填；預設小房防穿幫）
    const bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
    const MARGIN = 0.35;

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      "/bar-room/room.glb",
      (gltf) => {
        if (dead) return;
        const root = gltf.scene;
        // 歸一化：最大水平跨度→8m，地板落 y=0，中心回原點
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const s = SCALE_TARGET / Math.max(size.x, size.z, 0.001);
        root.scale.setScalar(s);
        const c = new THREE.Vector3();
        box.getCenter(c);
        root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
        root.updateMatrixWorld(true);
        const nb = new THREE.Box3().setFromObject(root);
        bounds.minX = nb.min.x + MARGIN;
        bounds.maxX = nb.max.x - MARGIN;
        bounds.minZ = nb.min.z + MARGIN;
        bounds.maxZ = nb.max.z - MARGIN;
        root.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              const sm = m as THREE.MeshStandardMaterial;
              // 法線內外保險：單 mesh 房間常有反面，雙面渲染（POC 代價可接受）
              sm.side = THREE.DoubleSide;
              sm.needsUpdate = true;
            }
          }
        });
        scene.add(root);
        roomObj = root;
        win.__barStage = "room-ok";
        // 酒保 Ivy：靜態掃描無 rig，Z-up 歸 Y→縮到 1.65m→落吧枱內側背牆。
        loader.load(
          BARTENDER_URL,
          (bg) => {
            if (dead) return;
            win.__barStage = "iva-loaded";
            const iva = bg.scene;
            const ibb = new THREE.Box3().setFromObject(iva);
            const isz = new THREE.Vector3();
            ibb.getSize(isz);
            if (isz.z >= isz.x && isz.z >= isz.y) {
              iva.rotation.x = -Math.PI / 2;
              iva.updateMatrixWorld(true);
              const fixed = new THREE.Box3().setFromObject(iva);
              fixed.getSize(isz);
            }
            const k = BARTENDER_HEIGHT / Math.max(isz.x, isz.y, isz.z, 0.001);
            iva.scale.setScalar(k);
            iva.updateMatrixWorld(true);
            const feet = new THREE.Box3().setFromObject(iva);
            const wrap = new THREE.Group();
            wrap.add(iva);
            iva.position.y -= feet.min.y;
            // 落位：房心開揚位（離出生點 ~2.9m，唔糊臉；探針自動落地）。
            const hx = 1.0;
            const hz = 0.4;
            // 落腳＝當地最低撞點（地板面，唔係 0）。
            const feetY = groundAt(hx, hz);
            wrap.position.set(hx, feetY, hz);
            ivaBaseY = feetY;
            // 面向出生點（房心＋z 方向）。
            wrap.rotation.y = Math.atan2(
              (bounds.minX + bounds.maxX) / 2 - hx,
              bounds.maxZ - 0.6 - hz,
            );
            wrap.traverse((o) => {
              const mesh = o as THREE.Mesh;
              if (mesh.isMesh) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const m of mats) {
                  const sm = m as THREE.MeshStandardMaterial;
                  sm.side = THREE.DoubleSide;
                  sm.needsUpdate = true;
                }
              }
            });
            scene.add(wrap);
            ivaWrap = wrap;
            win.__barStage = "iva-ok";
            // 打盞暖光俾佢（C 位要有光；跟身高走）。
            const spot = new THREE.PointLight("#ffd9a0", 10, 7, 1.8);
            spot.position.set(hx, feetY + 2.0, hz + 0.6);
            scene.add(spot);
            // 環繞即看佢：目標放胸口（全身入框，唔仰望）。
            orbit.tx = hx;
            orbit.ty = feetY + BARTENDER_HEIGHT * 0.55;
            orbit.tz = hz;
            orbit.theta = Math.PI * 1.5;
            orbit.phi = 1.2;
            orbit.radius = Math.min(2.5, orbit.maxR);
          },
          (p) => {
            if (p.total > 0) win.__barStage = `iva-progress-${Math.round((p.loaded / p.total) * 100)}`;
          },
          (e) => {
            win.__barStage = "iva-err";
            win.__barErr = String(e);
            if (!dead) readyRef.current(false, "酒保載入失敗（房正常）");
          },
        );
        orbit.tx = (bounds.minX + bounds.maxX) / 2;
        orbit.tz = (bounds.minZ + bounds.maxZ) / 2;
        orbit.maxR = Math.max(2.2, Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 - 0.3);
        orbit.radius = Math.min(5.2, orbit.maxR);
        // 出生：前緣門口側，面向房心（-z）；眼高 3.8 俯瞰全房
        pos.set((bounds.minX + bounds.maxX) / 2, EYE, bounds.maxZ - 0.6);
        yaw = 0;
        pitch = -0.2;
        setLoading(false);
        readyRef.current(true, `房 ${Math.round(nb.max.x - nb.min.x)}×${Math.round(nb.max.z - nb.min.z)}m`);
      },
      undefined,
      () => {
        if (dead) return;
        setLoading(false);
        readyRef.current(false, "模型載入失敗");
      },
    );

    const applyLook = (): void => {
      camera.position.copy(pos);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);
    };

    // 桌機：拖拽看＋WASD；手機：左半走＋右半看
    let lookId: number | null = null;
    let lookX = 0;
    let lookY = 0;
    let moveId: number | null = null;
    let moveX = 0;
    let moveY = 0;
    // 點選酒保判定（走路態：輕觸無拖即 raycast；拖拽看唔觸發）。
    let downX = 0;
    let downY = 0;
    let downT = 0;
    const el = renderer.domElement;
    el.style.touchAction = "none";
    // 環繞輸入態（指針表：單指轉＋雙指縮放；與走路態互斥）
    const orbitPts = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    const onDown = (e: PointerEvent): void => {
      orbit.lastTouch = performance.now();
      downX = e.clientX;
      downY = e.clientY;
      downT = performance.now();
      // 長按 600ms 無拖即摸頭（走路／環繞通用；拖走即取消）。
      pressMoved = false;
      if (pressTimer !== null) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (!pressMoved && tapIva(downX, downY)) doPat();
      }, 600);
      // 撳中她即進入按住態（放大＋低頭；拖走／鬆手即清）。
      pressingHer = tapIva(e.clientX, e.clientY);
      pressStart = performance.now();
      if (modeRef.current === "orbit") {
        orbitPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (orbitPts.size === 2) {
          const [a, b] = [...orbitPts.values()] as [{ x: number; y: number }, { x: number; y: number }];
          pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
        return;
      }
      const r = el.getBoundingClientRect();
      const leftSide = e.clientX - r.left < r.width / 2;
      if (e.pointerType === "touch" && leftSide && moveId === null) {
        moveId = e.pointerId;
        moveX = e.clientX;
        moveY = e.clientY;
      } else if (lookId === null) {
        lookId = e.pointerId;
        lookX = e.clientX;
        lookY = e.clientY;
        el.setPointerCapture(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent): void => {
      // 拖過 8px 即唔係長按／輕觸（兩態通用）。
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) {
        pressMoved = true;
        pressingHer = false;
        if (pressTimer !== null) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }
      if (modeRef.current === "orbit") {
        orbit.lastTouch = performance.now();
        const prev = orbitPts.get(e.pointerId);
        if (prev === undefined) return;
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        orbitPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (orbitPts.size === 1) {
          orbit.theta -= dx * 0.005;
          orbit.theta = Math.max(THETA_MIN, Math.min(THETA_MAX, orbit.theta));
          orbit.phi -= dy * 0.004;
          // 下限 1.12：吧區 3m 上有吊櫃，鏡頭鑽入即黑（血淚史）。
          orbit.phi = Math.max(1.12, Math.min(1.42, orbit.phi));
        } else if (orbitPts.size === 2 && pinchDist > 0) {
          const [a, b] = [...orbitPts.values()] as [{ x: number; y: number }, { x: number; y: number }];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 0) {
            orbit.radius = Math.max(2.2, Math.min(orbit.maxR, (orbit.radius * pinchDist) / d));
            pinchDist = d;
          }
        }
        return;
      }
      if (e.pointerId === lookId) {
        yaw -= (e.clientX - lookX) * 0.0042;
        pitch -= (e.clientY - lookY) * 0.0042;
        pitch = Math.max(-1.1, Math.min(1.1, pitch));
        lookX = e.clientX;
        lookY = e.clientY;
      } else if (e.pointerId === moveId) {
        moveX = e.clientX;
        moveY = e.clientY;
      }
    };
    const onUp = (e: PointerEvent): void => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      pressingHer = false;
      if (modeRef.current === "orbit") {
        orbitPts.delete(e.pointerId);
        if (orbitPts.size < 2) pinchDist = 0;
        // 環繞態輕觸／雙擊（拖過／按住超 350ms 唔算；長按已走摸頭）。
        if (orbitPts.size === 0) {
          const quick = Math.hypot(e.clientX - downX, e.clientY - downY) < 8 && performance.now() - downT < 350;
          if (quick) tapOrDouble(e.clientX, e.clientY);
        }
        return;
      }
      if (e.pointerId === lookId) lookId = null;
      if (e.pointerId === moveId) {
        moveId = null;
        moveX = 0;
        moveY = 0;
      }
      // 輕觸／雙擊（拖過 8px／按住超 350ms 當視角操作，唔算；長按已走摸頭）。
      const tapped = Math.hypot(e.clientX - downX, e.clientY - downY) < 8 && performance.now() - downT < 350;
      if (tapped) tapOrDouble(e.clientX, e.clientY);
    };
    const onKey = (down: boolean) => (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        if (down) keys.add(k);
        else keys.delete(k);
      }
    };
    const kd = onKey(true);
    const ku = onKey(false);
    el.addEventListener("pointerdown", onDown);
    const onWheel = (e: WheelEvent): void => {
      if (modeRef.current !== "orbit") return;
      orbit.lastTouch = performance.now();
      orbit.radius = Math.max(2.2, Math.min(orbit.maxR, orbit.radius * (1 + e.deltaY * 0.001)));
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    const clock = new THREE.Clock();
    let raf = 0;
    // 射線擋牆（單 mesh 房無家具資訊：走之前朝移動方向射 0.55m，撞即停；
    // 節流 100ms 一次，70萬面暴力求交桌面可接受，手機待測幀率）。
    const ray = new THREE.Raycaster();
    ray.far = 0.55;
    let roomObj: THREE.Object3D | null = null;
    // 房係掃描貨：地板唔係 y=0（ slab 底），頭頂仲有吊櫃／假天花（2.2–3.1m）。
    // 落腳一律用垂直探針最低撞點（地板面），唔估數字。
    const probeDown = (x: number, z: number): number[] => {
      if (roomObj === null) return [];
      const pr = new THREE.Raycaster(new THREE.Vector3(x, 4.5, z), new THREE.Vector3(0, -1, 0), 0, 9);
      return pr.intersectObject(roomObj, true).map((h) => h.point.y);
    };
    const groundAt = (x: number, z: number): number => {
      const ys = probeDown(x, z);
      // 柱底多數係 slab 底／穿底（DoubleSide），地板面取次低（保底 0）。
      return ys.length > 1 ? ys[ys.length - 2]! : (ys.length > 0 ? ys[0]! : 0);
    };
    // 酒保體（程序化動畫＋點選＋徑向擋人；房載入後回填）。
    let ivaWrap: THREE.Group | null = null;
    let ivaBaseY = 0;
    let lastGreet = 0;
    const tapRay = new THREE.Raycaster();
    tapRay.far = 30;
    // 觸摸互動：單擊開聊／雙擊轉圈／長按摸頭（無 rig，全部程序化＋bubble）。
    let lastTap = 0;
    let pendingChat: ReturnType<typeof setTimeout> | null = null;
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let pressMoved = false;
    let inviteTimer: ReturnType<typeof setTimeout> | null = null;
    let bowUntil = 0;
    let spinUntil = 0;
    let spinFrom = 0;
    // 按住即時手感：撳中她即放大＋低頭（鬆手回彈；手機再加震動）。
    let pressingHer = false;
    let pressStart = 0;
    let wrapScale = 1;
    const buzz = (pattern: number | number[]): void => {
      try {
        navigator.vibrate?.(pattern);
      } catch {
        /* 無震動裝置即靜默 */
      }
    };
    // bubble 快閃（4s 自散，唔黐住個場）。
    const flashInvite = (text: string): void => {
      setInvite(text);
      if (inviteTimer !== null) clearTimeout(inviteTimer);
      inviteTimer = setTimeout(() => setInvite(null), 4000);
    };
    const doOpenChat = (): void => {
      openChatRef.current();
    };
    const tapIva = (cx: number, cy: number): boolean => {
      if (ivaWrap === null) return false;
      const br = el.getBoundingClientRect();
      const nx = ((cx - br.left) / br.width) * 2 - 1;
      const ny = -((cy - br.top) / br.height) * 2 + 1;
      tapRay.setFromCamera(new THREE.Vector2(nx, ny), camera);
      return tapRay.intersectObject(ivaWrap, true).length > 0;
    };
    const doPat = (): void => {
      if (ivaWrap === null || performance.now() < spinUntil) return;
      bowUntil = performance.now() + 900;
      buzz(30);
      // 台词走模型（鞠躬先行，话后到也自然）。
      void (async () => {
        const line = await askIvy({ event: "pat" });
        if (line !== null) flashInvite(line);
      })();
    };
    const doCheers = (): void => {
      if (ivaWrap === null) return;
      lastTap = 0;
      spinFrom = ivaWrap.rotation.y;
      spinUntil = performance.now() + 900;
      buzz([20, 40, 20]);
      void (async () => {
        const line = await askIvy({ event: "cheers" });
        if (line !== null) flashInvite(line);
      })();
    };
    // 單擊延遲開（等 280ms 睇下有無第二擊變雙擊；撳即震一下先）。
    const tapOrDouble = (cx: number, cy: number): void => {
      if (!tapIva(cx, cy)) return;
      buzz(15);
      const nowMs = performance.now();
      if (nowMs - lastTap < 300) {
        if (pendingChat !== null) {
          clearTimeout(pendingChat);
          pendingChat = null;
        }
        doCheers();
      } else {
        lastTap = nowMs;
        if (pendingChat !== null) clearTimeout(pendingChat);
        pendingChat = setTimeout(() => {
          pendingChat = null;
          doOpenChat();
        }, 280);
      }
    };
    // Debug 窗口（POC 排障：讀鏡頭／酒保／包圍盒，驗落位）。
    const win = window as unknown as { __bar?: unknown; __barStage?: string; __barErr?: string };
    win.__barStage = "boot";
    window.addEventListener("unhandledrejection", (ev) => {
      win.__barStage = "rejected";
      win.__barErr = String((ev.reason as Error)?.message ?? ev.reason);
    });
    win.__bar = {
      cam: camera.position,
      orbit,
      bounds,
      iva: (): { x: number; y: number; z: number } | null =>
        ivaWrap === null ? null : { x: ivaWrap.position.x, y: ivaWrap.position.y, z: ivaWrap.position.z },
      roomOff: (): void => {
        if (roomObj !== null) roomObj.visible = false;
      },
      roomOn: (): void => {
        if (roomObj !== null) roomObj.visible = true;
      },
      // 探針：由 (x,4.5,z) 垂直射落房，返成柱撞點（由高到低，揀地板用）。
      probe: (x: number, z: number): number[] => probeDown(x, z).map((y) => +y.toFixed(2)),
    };
    let lastRayCheck = 0;
    let blockX = 1;
    let blockZ = 1;
    const loop = (): void => {
      if (dead) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, clock.getDelta());
      if (modeRef.current === "orbit") {
        // 無操作 4s 即扇形慢搖（展廳感，撞界即反彈）；一碰即停。
        if (performance.now() - orbit.lastTouch > 4000) {
          orbit.theta += dt * 0.12 * orbit.dir;
          if (orbit.theta >= THETA_MAX) {
            orbit.theta = THETA_MAX;
            orbit.dir = -1;
          } else if (orbit.theta <= THETA_MIN) {
            orbit.theta = THETA_MIN;
            orbit.dir = 1;
          }
        }
        const sp = Math.sin(orbit.phi);
        camera.position.set(
          orbit.tx + orbit.radius * sp * Math.sin(orbit.theta),
          orbit.ty + orbit.radius * Math.cos(orbit.phi),
          orbit.tz + orbit.radius * sp * Math.cos(orbit.theta),
        );
        // 鏡頭夾房內（酒保企背牆邊，大半徑軌道會掃穿牆／枱；夾死保唔穿牆）。
        camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x));
        camera.position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z));
        // 上限 2.95：吧區吊櫃 3.05，鑽入即黑；下限防穿地板。
        camera.position.y = Math.max(0.8, Math.min(2.95, camera.position.y));
        camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
        // 環繞即看佢：佢都望返你（呼吸＋直接面向鏡頭；鞠躬／轉圈唔搶）。
        if (ivaWrap !== null) {
          const t = performance.now() * 0.001;
          const nowMs = performance.now();
          wrapScale += ((pressingHer ? 1.045 : 1) - wrapScale) * Math.min(1, dt * 10);
          ivaWrap.scale.setScalar(wrapScale);
          const pressDip = pressingHer ? Math.min(0.28, ((nowMs - pressStart) / 600) * 0.28) : 0;
          if (nowMs < bowUntil) {
            const p = 1 - (bowUntil - nowMs) / 900;
            ivaWrap.rotation.x = Math.sin(p * Math.PI) * 0.28;
          } else {
            ivaWrap.rotation.x = pressDip;
          }
          let hop = 0;
          if (nowMs < spinUntil) {
            const p = 1 - (spinUntil - nowMs) / 900;
            ivaWrap.rotation.y = spinFrom + p * Math.PI * 2;
            hop = Math.sin(p * Math.PI) * 0.12;
          } else {
            ivaWrap.rotation.y = Math.atan2(
              camera.position.x - ivaWrap.position.x,
              camera.position.z - ivaWrap.position.z,
            );
          }
          ivaWrap.position.y = ivaBaseY + Math.sin(t * 1.3) * 0.02 + hop;
        }
        renderer.render(scene, camera);
        return;
      }
      // 移動（前＝yaw 朝向；手機左半拖向量）
      let f = 0;
      let s = 0;
      if (keys.has("w") || keys.has("arrowup")) f += 1;
      if (keys.has("s") || keys.has("arrowdown")) f -= 1;
      if (keys.has("a") || keys.has("arrowleft")) s -= 1;
      if (keys.has("d") || keys.has("arrowright")) s += 1;
      let mx = 0;
      let mz = 0;
      if (moveId !== null) {
        const r = el.getBoundingClientRect();
        mx = (moveX - (r.left + r.width / 4)) / (r.width / 4);
        mz = (moveY - (r.top + r.height / 2)) / (r.height / 4);
        mx = Math.max(-1, Math.min(1, mx));
        mz = Math.max(-1, Math.min(1, mz));
      }
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const vx = (fx * f + rx * s) * SPEED + (fx * -mz + rx * mx) * SPEED;
      const vz = (fz * f + rz * s) * SPEED + (fz * -mz + rz * mx) * SPEED;
      // 射線擋牆：X／Z 分軸各射一條，撞即該軸停（貼牆滑行不斷走）。
      const now = performance.now();
      if (roomObj !== null && (vx !== 0 || vz !== 0) && now - lastRayCheck > 100) {
        lastRayCheck = now;
        const origin = new THREE.Vector3(pos.x, EYE - 0.3, pos.z);
        blockX = 1;
        blockZ = 1;
        if (vx !== 0) {
          ray.set(origin, new THREE.Vector3(Math.sign(vx), 0, 0));
          if (ray.intersectObject(roomObj, true).length > 0) blockX = 0;
        }
        if (vz !== 0) {
          ray.set(origin, new THREE.Vector3(0, 0, Math.sign(vz)));
          if (ray.intersectObject(roomObj, true).length > 0) blockZ = 0;
        }
      } else if (vx === 0 && vz === 0) {
        blockX = 1;
        blockZ = 1;
      }
      pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x + vx * blockX * dt));
      pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z + vz * blockZ * dt));
      // 酒保：呼吸浮動＋面向玩家＋徑向擋人＋走近招呼（無 rig 的程序化撐場）。
      if (ivaWrap !== null) {
        const t = performance.now() * 0.001;
        const nowMs = performance.now();
        // 按住即時：放大＋600ms 內慢慢低頭（接摸頭不斷層；鬆手回彈）。
        wrapScale += ((pressingHer ? 1.045 : 1) - wrapScale) * Math.min(1, dt * 10);
        ivaWrap.scale.setScalar(wrapScale);
        const pressDip = pressingHer ? Math.min(0.28, ((nowMs - pressStart) / 600) * 0.28) : 0;
        const dx = pos.x - ivaWrap.position.x;
        const dz = pos.z - ivaWrap.position.z;
        const dist = Math.hypot(dx, dz);
        // 貼近前傾（1.5m 內 +0.06，活人感；鞠躬／按住時唔搶）。
        const lean = dist < 1.5 ? 0.06 : 0;
        // 長按鞠躬（0.9s 前俯後回；轉圈時唔搶）。
        if (nowMs < bowUntil) {
          const p = 1 - (bowUntil - nowMs) / 900;
          ivaWrap.rotation.x = Math.sin(p * Math.PI) * 0.28;
        } else {
          ivaWrap.rotation.x = pressDip + lean;
        }
        let hop = 0;
        if (nowMs < spinUntil) {
          // 雙擊轉圈＋小跳（0.9s；呢段唔跟人）。
          const p = 1 - (spinUntil - nowMs) / 900;
          ivaWrap.rotation.y = spinFrom + p * Math.PI * 2;
          hop = Math.sin(p * Math.PI) * 0.12;
        } else {
          const want = Math.atan2(dx, dz);
          let d = want - ivaWrap.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          ivaWrap.rotation.y += d * Math.min(1, dt * 3);
        }
        ivaWrap.position.y = ivaBaseY + Math.sin(t * 1.3) * 0.02 + hop;
        if (dist < BLOCK_RADIUS && dist > 0.001) {
          pos.x = ivaWrap.position.x + (dx / dist) * BLOCK_RADIUS;
          pos.z = ivaWrap.position.z + (dz / dist) * BLOCK_RADIUS;
        }
        if (dist < CHAT_RADIUS && performance.now() - lastGreet > 60000) {
          lastGreet = performance.now();
          // 招呼词走模型（60s 节流，失败就安静等下次）。
          void (async () => {
            const line = await askIvy({ event: "greet" });
            if (line !== null) flashInvite(line);
          })();
        }
      }
      pos.y = EYE;
      applyLook();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    const onResize = (): void => {
      const w = mount.clientWidth || 390;
      const h = mount.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (pressTimer !== null) clearTimeout(pressTimer);
      if (pendingChat !== null) clearTimeout(pendingChat);
      if (inviteTimer !== null) clearTimeout(inviteTimer);
      if (audioRef.current !== null) audioRef.current.pause();
      // 录音中卸载：停表停机停识别（同步能做的全做）。
      if (recRef.current !== null) {
        clearInterval(recRef.current.timer);
        recRef.current.srBox.cancelled = true;
        try {
          recRef.current.srBox.rec?.stop();
        } catch {
          /* 已停 */
        }
        try {
          recRef.current.mr.stop();
        } catch {
          /* 已停即过 */
        }
        recRef.current.stream.getTracks().forEach((t) => t.stop());
        recRef.current = null;
      }
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const m = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div ref={mountRef} className="absolute inset-0" aria-hidden />
      {/* 環繞／走路切換（酒保到了以後：環繞看他，走路走過去） */}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "walk" ? "orbit" : "walk"))}
        className="absolute right-3 top-3 z-20 rounded-full bg-black/55 px-4 py-2 text-xs font-bold text-amber-100 ring-1 ring-white/20 backdrop-blur"
      >
        {mode === "walk" ? "⭮ 環繞" : "🚶 走路"}
      </button>
      {/* 进场幕（推门进酒吧）：霓虹招牌闪 → 招牌熄、门缝暖光胀开 → 双门滑开卸幕。 */}
      {!entered && (
        <div className="absolute inset-0 z-40 overflow-hidden bg-black" aria-hidden>
          {/* 门后暖光（门开时胀开）。 */}
          <div
            className={`absolute inset-0 transition-opacity delay-300 duration-1000 ${doorsOpen ? "opacity-100" : "opacity-0"}`}
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(251,191,36,.55), rgba(120,53,15,.25) 45%, transparent 70%)",
            }}
          />
          {/* 左门。 */}
          <div
            className={`absolute inset-y-0 left-0 w-1/2 transition-transform duration-[1100ms] ease-in-out ${doorsOpen ? "-translate-x-full" : ""}`}
            style={{
              background: "linear-gradient(105deg, #1c0f08, #3b1f0e 60%, #120906)",
              borderRight: "2px solid rgba(251,191,36,.5)",
              boxShadow: "8px 0 30px rgba(251,191,36,.25)",
            }}
          />
          {/* 右门。 */}
          <div
            className={`absolute inset-y-0 right-0 w-1/2 transition-transform duration-[1100ms] ease-in-out ${doorsOpen ? "translate-x-full" : ""}`}
            style={{
              background: "linear-gradient(255deg, #1c0f08, #3b1f0e 60%, #120906)",
              borderLeft: "2px solid rgba(251,191,36,.5)",
              boxShadow: "-8px 0 30px rgba(251,191,36,.25)",
            }}
          />
          {/* 霓虹招牌（加载时；门开即熄）。 */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-5 transition-opacity duration-500 ${doorsOpen ? "opacity-0" : "opacity-100"}`}
          >
            <span className="bar-neon">
              <Martini
                size={64}
                strokeWidth={1.5}
                className="text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,.8)]"
              />
            </span>
            <span className="bar-neon text-4xl font-bold tracking-[.35em]">IVY BAR</span>
          </div>
        </div>
      )}
      {/* 18＋ 閘（酒保對話前置；session 內記住）。 */}
      {!adult && !loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-xs rounded-2xl bg-zinc-900 p-5 text-center ring-1 ring-white/15">
            <div className="text-lg font-bold text-amber-100">歡迎嚟到酒吧</div>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              裏面有酒保 Ivy 同你傾偈。入場前確認你已年滿 18 歲。
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem("bar-adult", "1");
                setAdult(true);
              }}
              className="mt-4 w-full rounded-full bg-amber-400 py-2.5 text-sm font-bold text-black"
            >
              我已滿 18 歲，入場
            </button>
          </div>
        </div>
      )}
      {/* 走近招呼（撳即開聊）。 */}
      {invite !== null && !chatOpen && adult && (
        <button
          type="button"
          onClick={openChat}
          className="absolute bottom-16 left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-2xl bg-black/70 px-4 py-2.5 text-left text-xs leading-relaxed text-amber-100 ring-1 ring-amber-200/30 backdrop-blur"
        >
          <span className="font-bold">Ivy：</span>
          {invite}
          <span className="mt-1 block text-[11px] text-white/60">撳呢度同佢傾偈 →</span>
        </button>
      )}
      {/* 对话面板（台词＋语音全部走 MiniMax；失败显示系统提示）。 */}
      {chatOpen && (
        <div className="absolute inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md rounded-t-3xl bg-zinc-950/95 p-4 pb-6 ring-1 ring-white/15 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold text-amber-100">{BARTENDER_NAME} · 酒保</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVoiceOn((v) => !v)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70"
              >
                {voiceOn ? "🔊 语音开" : "🔇 语音关"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (audioRef.current !== null) audioRef.current.pause();
                  setChatOpen(false);
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70"
              >
                收起
              </button>
            </div>
          </div>
          {/* 打字时只留输入行（消息＋大按钮全收，键盘再顶也盖不住 Ivy）。 */}
          {!inputFocused && (
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {msgs.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.from === "her"
                      ? "self-start rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-xs leading-relaxed text-white"
                      : m.from === "me"
                        ? "self-end rounded-2xl rounded-tr-sm bg-amber-400 px-3 py-2 text-xs leading-relaxed text-black"
                        : "self-center rounded-full bg-white/5 px-3 py-1 text-[11px] text-white/50"
                  }
                >
                  {m.text}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void sendChat();
              }}
              placeholder={`和 ${BARTENDER_NAME} 说话…（她用英文回你）`}
              className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-2 text-xs text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-amber-200/50"
            />
            <button
              type="button"
              onClick={() => void sendChat()}
              disabled={sending}
              className="shrink-0 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
            >
              {sending ? "…" : "送出"}
            </button>
          </div>
          {/* 圆圈对讲（粤／普／英）：拇指按住，呼吸光圈待命，录音扩散波＋秒数。 */}
          {!inputFocused && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <button
                type="button"
                aria-label={recording ? `录音中 ${recSecs} 秒，松手发送` : "按住说话"}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  void startRecord();
                }}
                onPointerUp={() => void stopRecord(true)}
                onPointerCancel={() => void stopRecord(false)}
                className={`relative flex h-[76px] w-[76px] shrink-0 touch-none items-center justify-center rounded-full transition-all select-none ${
                  recording
                    ? "scale-105 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,.6)]"
                    : "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-[0_0_18px_rgba(251,191,36,.45)] active:scale-95"
                }`}
              >
                {recording ? (
                  <>
                    <span className="absolute inset-0 animate-ping rounded-full bg-red-400/50" />
                    <span
                      className="absolute inset-0 animate-ping rounded-full bg-red-400/30"
                      style={{ animationDelay: ".5s" }}
                    />
                  </>
                ) : (
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-300/30 [animation-duration:2.4s]" />
                )}
                <Mic size={30} aria-hidden strokeWidth={2.2} className="relative" />
              </button>
              <span className={`text-[11px] font-bold ${recording ? "text-red-300" : "text-white/60"}`}>
                {recording ? `● ${recSecs}s 松手发送` : "按住说话 · Hold to Talk"}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
