// Session payload stored in the signed httpOnly cookie.
export interface SessionData {
  twitch_user_id: string;
  username: string;
  is_mod: boolean;
  is_broadcaster: boolean;
}

declare global {
  namespace App {
    interface Locals {
      session: SessionData | null;
    }
  }
}

export {};
