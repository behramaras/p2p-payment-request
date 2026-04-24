export type RequestStatus = "pending" | "paid" | "declined" | "expired" | "cancelled";

export type Summary = {
  id: string;
  counterparty_email: string;
  amount_cents: number;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
};

export type Detail = Summary & {
  note: string | null;
  sender_email: string;
  recipient_email: string;
  paid_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  seconds_until_expiry: number | null;
};

export type UserOut = { id: number; email: string };
