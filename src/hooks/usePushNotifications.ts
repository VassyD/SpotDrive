import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

type Permission = "default" | "denied" | "granted";

interface UsePushNotificationsReturn {
  permission: Permission;
  request: () => Promise<Permission>;
  send: (title: string, body: string) => void;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuth();
  const [permission, setPermission] = useState<Permission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  const request = useCallback(async (): Promise<Permission> => {
    if (typeof Notification === "undefined") return "denied";
    const result = await Notification.requestPermission() as Permission;
    setPermission(result);
    if (result === "granted" && user) {
      await supabase
        .from("profiles")
        .update({ push_enabled: true })
        .eq("id", user.id)
        .catch(() => {}); // Non-critical — ignore if column doesn't exist yet
    }
    return result;
  }, [user]);

  const send = useCallback((title: string, body: string): void => {
    if (permission !== "granted") return;
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "spotdrive",
        renotify: true,
      });
    } catch (e) {
      console.log("Notification (fallback):", title, body);
    }
  }, [permission]);

  return { permission, request, send };
}
