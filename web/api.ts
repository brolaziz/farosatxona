export type Row = Record<string, any>;
export type Session = {
  token: string;
  expires: number;
  user: Row;
  role: string;
  chat_id: string | null;
  preview: boolean;
  botUsername: string;
  supportUrl: string;
  groups: Row[];
  settings: Row;
};
let token = "";
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export function setToken(value: string) {
  token = value;
}
export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch("/api/" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(response.status, data.error || "Aloqa xatosi");
  return data;
}
export const post = (path: string, data: Row) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const patch = (path: string, data: Row) =>
  api(path, { method: "PATCH", body: JSON.stringify(data) });
export async function download(path: string, filename: string) {
  const response = await fetch("/api/" + path, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error);
  }
  const url = URL.createObjectURL(await response.blob()),
    link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
