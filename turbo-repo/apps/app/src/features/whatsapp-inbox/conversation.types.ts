/** Frontend mirrors of the miot-conversational domain records (Jackson serializes them camelCase). */

export type MessageDirection = "INBOUND" | "OUTBOUND";

export type MessageStatus =
  | "RECEIVED"
  | "PENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "DOCUMENT"
  | "AUDIO"
  | "VIDEO"
  | "STICKER"
  | "TEMPLATE"
  | "UNKNOWN";

export interface Conversation {
  id: string;
  phoneE164: string;
  waContactName: string | null;
  driverId: string | null;
  contextServiceCode: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  sessionExpiresAt: string | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string | null;
  templateName: string | null;
  mediaRef: string | null;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  status: MessageStatus;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}
