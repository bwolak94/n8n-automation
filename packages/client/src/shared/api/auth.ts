import { apiClient } from "./client.js";
import type { AuthResponse, LoginCredentials } from "../types/index.js";

export async function loginApi(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  return apiClient.post("auth/login", { json: credentials }).json<AuthResponse>();
}

export async function logoutApi(): Promise<void> {
  await apiClient.post("auth/logout");
}
