"use client";

import { useContext } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

/** One box: the digit pops in, the caret blinks where the next one goes. */
function Slot({ index, state }: { index: number; state: "idle" | "error" | "success" }) {
  const context = useContext(OTPInputContext);
  const reduceMotion = useReducedMotion();
  const { char, hasFakeCaret, isActive } = context?.slots[index] ?? {};
  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex h-12 w-10 items-center justify-center rounded-lg border border-input bg-background text-xl font-semibold tabular-nums shadow-xs transition-[border-color,box-shadow,background-color] duration-200 sm:h-14 sm:w-12 dark:bg-input/30",
        isActive && "z-10 border-ring ring-3 ring-ring/50",
        char && state === "idle" && "border-primary/50",
        state === "error" && "border-destructive bg-destructive/5 ring-destructive/20",
        state === "success" && "border-success bg-success/10 text-success"
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {char && (
          <motion.span
            key={char}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
          >
            {char}
          </motion.span>
        )}
      </AnimatePresence>
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

/**
 * Six-digit code (sign-in by e-mail or authenticator app, TOTP setup). Paste,
 * SMS/e-mail autofill (`one-time-code`) and digits only; `onComplete` fires
 * when the sixth digit lands. Bump `shake` to shake it after a wrong code.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  state = "idle",
  shake = 0,
  disabled,
  autoFocus,
  label = "Código de 6 dígitos",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  state?: "idle" | "error" | "success";
  shake?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      key={shake}
      animate={shake && !reduceMotion ? { x: [0, -10, 10, -7, 7, -3, 0] } : undefined}
      transition={{ duration: 0.4 }}
      className="flex justify-center"
    >
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        pattern={REGEXP_ONLY_DIGITS}
        // "123 456", "123-456" or a whole sentence from an e-mail: keep the digits.
        pasteTransformer={(text) => text.replace(/\D/g, "").slice(0, 6)}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label}
        aria-invalid={state === "error" || undefined}
        containerClassName="gap-2 sm:gap-3"
      >
        <InputOTPGroup className="gap-1.5 sm:gap-2">
          {[0, 1, 2].map((index) => (
            <Slot key={index} index={index} state={state} />
          ))}
        </InputOTPGroup>
        <span aria-hidden className="h-0.5 w-3 rounded-full bg-border" />
        <InputOTPGroup className="gap-1.5 sm:gap-2">
          {[3, 4, 5].map((index) => (
            <Slot key={index} index={index} state={state} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </motion.div>
  );
}
