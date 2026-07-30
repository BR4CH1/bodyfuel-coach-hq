/**
 * Fuely — das offizielle BodyFuel Maskottchen.
 *
 * Wiederverwendbare Komponente. Verschiedene Emotionen als eigenständige
 * Assets, gemeinsame Idle-/Animation-Utilities über CSS-Klassen.
 *
 * Beispiele:
 *   <Fuely emotion="happy" />
 *   <Fuely emotion="waving" size="lg" message="Hey Manuel 👋" />
 *   <Fuely emotion="celebrating" animation="celebrate" size="xl" />
 */
import { cn } from "@/lib/utils";
import happy from "@/assets/fuely-happy.png.asset.json";
import motivated from "@/assets/fuely-motivated.png.asset.json";
import thinking from "@/assets/fuely-thinking.png.asset.json";
import celebrating from "@/assets/fuely-celebrating.png.asset.json";
import waving from "@/assets/fuely-waving.png.asset.json";
import sad from "@/assets/fuely-sad.png.asset.json";

export type FuelyEmotion =
  "happy" | "motivated" | "thinking" | "celebrating" | "waving" | "sad" | "proud" | "focused";

export type FuelyAnimation =
  "idle" | "bounce" | "wiggle" | "float" | "wave" | "thinking" | "success" | "celebrate" | "none";
export type FuelySize = "xs" | "sm" | "md" | "lg" | "xl";

const EMOTION_ASSET: Record<FuelyEmotion, { url: string }> = {
  happy,
  motivated,
  thinking,
  celebrating,
  waving,
  sad,
  proud: motivated, // Fallback: Daumen hoch = stolz
  focused: thinking,
};

const SIZE_CLASS: Record<FuelySize, string> = {
  xs: "h-10 w-10",
  sm: "h-14 w-14",
  md: "h-20 w-20",
  lg: "h-28 w-28",
  xl: "h-40 w-40",
};

const ANIMATION_CLASS: Record<FuelyAnimation, string> = {
  idle: "fuely-idle",
  bounce: "fuely-bounce",
  wiggle: "fuely-wiggle",
  float: "fuely-float",
  wave: "fuely-wave",
  thinking: "fuely-thinking",
  success: "fuely-success",
  celebrate: "fuely-celebrate",
  none: "",
};

type FuelyProps = {
  emotion?: FuelyEmotion;
  size?: FuelySize;
  animation?: FuelyAnimation;
  message?: string;
  className?: string;
  imgClassName?: string;
  flip?: boolean;
};

export function Fuely({
  emotion = "happy",
  size = "md",
  animation = "idle",
  message,
  className,
  imgClassName,
  flip = false,
}: FuelyProps) {
  const asset = EMOTION_ASSET[emotion] ?? EMOTION_ASSET.happy;

  if (message) {
    return (
      <div className={cn("flex items-end gap-2", className)}>
        <img
          src={asset.url}
          alt={`Fuely (${emotion})`}
          loading="lazy"
          className={cn(
            SIZE_CLASS[size],
            ANIMATION_CLASS[animation],
            "shrink-0 object-contain drop-shadow-md",
            flip && "-scale-x-100",
            imgClassName,
          )}
        />
        <div className="relative mb-2 max-w-[220px] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-neutral-900 shadow-md">
          {message}
          <span aria-hidden className="absolute -left-1.5 bottom-2 h-3 w-3 rotate-45 bg-white" />
        </div>
      </div>
    );
  }

  return (
    <img
      src={asset.url}
      alt={`Fuely (${emotion})`}
      loading="lazy"
      className={cn(
        SIZE_CLASS[size],
        ANIMATION_CLASS[animation],
        "object-contain drop-shadow-md",
        flip && "-scale-x-100",
        className,
        imgClassName,
      )}
    />
  );
}

export default Fuely;
