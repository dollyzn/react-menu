/** WhatsApp Cloud API per store (ADR 0025). */

/** Meta's template review status, or MISSING (not created in the WABA). */
export type WhatsAppTemplateStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'
  | 'PAUSED'
  | 'DISABLED'
  | 'IN_APPEAL'
  | 'LIMIT_EXCEEDED'
  | 'ARCHIVED'
  | 'DELETED'
  | 'PENDING_DELETION'
  | 'MISSING';

export type WhatsAppTemplate = {
  name: string;
  /** What it is for ("Pedido pronto"). */
  label: string;
  status: WhatsAppTemplateStatus;
  /** UTILITY, AUTHENTICATION (Meta may recategorize). */
  category: string | null;
  /** Why it was rejected, or the error creating it. */
  reason: string | null;
};

/** GET /stores/:storeId/whatsapp (managers). */
export type WhatsAppConnection = {
  /** The server has the Tech Provider app configured (or the development fake). */
  available: boolean;
  /** What the browser needs to open Embedded Signup; null when unavailable. */
  signup: {
    appId: string | null;
    configId: string | null;
    graphVersion: string;
    /** Development fake: "Conectar número de teste" instead of Meta's flow. */
    fake: boolean;
  } | null;
  account: {
    displayPhoneNumber: string;
    verifiedName: string | null;
    wabaId: string;
    /** A WhatsApp Business app number also used on the phone. */
    coexistence: boolean;
    notifyOrders: boolean;
    customerLogin: boolean;
    /** The token stopped working: connect again. */
    broken: boolean;
    lastError: string | null;
    /** Meta refused a message for the payment method (add one in WhatsApp Manager). */
    paymentIssue: boolean;
    templates: WhatsAppTemplate[];
    templatesCheckedAt: string | null;
    connectedAt: string;
  } | null;
};

/** POST /stores/:storeId/whatsapp: what Embedded Signup gave the browser. */
export type WhatsAppConnectInput =
  | {
      code: string;
      wabaId: string;
      phoneNumberId: string;
      businessId?: string;
      coexistence?: boolean;
    }
  | { fake: true };

/** PUT /stores/:storeId/whatsapp/settings */
export type WhatsAppSettingsInput = {
  notifyOrders?: boolean;
  customerLogin?: boolean;
};

export type WhatsAppMessageKind =
  | 'order_received'
  | 'order_ready'
  | 'order_cancelled'
  | 'login_code'
  | 'login_reply';

/** GET /stores/:storeId/whatsapp/messages: the last 30 sent through the number. */
export type WhatsAppMessageLog = {
  id: string;
  kind: WhatsAppMessageKind;
  /** The phone, partly hidden. */
  to: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped';
  errorCode: number | null;
  errorTitle: string | null;
  orderNumber: number | null;
  createdAt: string;
};
