import { validateSessionToken } from "@/lib/auth";

export async function getRequestUser(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("session_token="))
    ?.slice("session_token=".length);
  return token ? validateSessionToken(decodeURIComponent(token)) : null;
}
