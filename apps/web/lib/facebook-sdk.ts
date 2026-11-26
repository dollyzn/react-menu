/**
 * Facebook's JavaScript SDK, loaded on demand: only the store page's
 * "Conectar WhatsApp" (Embedded Signup, ADR 0025) needs it. Calls to the
 * Graph API are the API's job; the SDK only opens Meta's flow.
 */

export type FacebookLoginResponse = {
  status?: string;
  authResponse?: { code?: string } | null;
};

export type FacebookSdk = {
  init(options: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras?: Record<string, unknown>;
    }
  ): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let loading: Promise<FacebookSdk> | null = null;

/** Loads and initializes the SDK once per page (pt_BR), for this app and Graph version. */
export function loadFacebookSdk(appId: string, version: string) {
  loading ??= new Promise<FacebookSdk>((resolve, reject) => {
    const ready = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version });
      resolve(window.FB!);
    };
    if (window.FB) return ready();
    window.fbAsyncInit = ready;
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Não foi possível carregar o Facebook. Confira a conexão ou bloqueadores."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/** What Embedded Signup posts to the page when the flow ends (session logging). */
export type EmbeddedSignupEvent =
  | {
      type: "WA_EMBEDDED_SIGNUP";
      event: "FINISH" | "FINISH_ONLY_WABA" | "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
      data: { phone_number_id?: string; waba_id?: string; business_id?: string };
    }
  | { type: "WA_EMBEDDED_SIGNUP"; event: "CANCEL"; data: { current_step?: string } }
  | { type: "WA_EMBEDDED_SIGNUP"; event: "ERROR"; data: { error_message?: string; error_code?: number | string } };

/** The flow's message, if this window message is one (from facebook.com only). */
export function embeddedSignupEvent(event: MessageEvent): EmbeddedSignupEvent | null {
  let origin: URL;
  try {
    origin = new URL(event.origin);
  } catch {
    return null;
  }
  if (origin.protocol !== "https:" || !(origin.hostname === "facebook.com" || origin.hostname.endsWith(".facebook.com"))) {
    return null;
  }
  try {
    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    return data?.type === "WA_EMBEDDED_SIGNUP" ? (data as EmbeddedSignupEvent) : null;
  } catch {
    return null;
  }
}
