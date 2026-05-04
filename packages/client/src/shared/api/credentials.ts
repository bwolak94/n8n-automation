import { apiClient } from "./client.js";
import type { CredentialCreate, CredentialUpdate, CredentialResponse } from "@automation-hub/shared";

export type { CredentialResponse };

export async function fetchCredentials(): Promise<{ items: CredentialResponse[] }> {
  return apiClient.get("credentials").json<{ items: CredentialResponse[] }>();
}

export async function fetchCredential(id: string): Promise<CredentialResponse> {
  return apiClient.get(`credentials/${id}`).json<CredentialResponse>();
}

export async function createCredential(data: CredentialCreate): Promise<CredentialResponse> {
  return apiClient.post("credentials", { json: data }).json<CredentialResponse>();
}

export async function updateCredential(
  id: string,
  data: CredentialUpdate
): Promise<CredentialResponse> {
  return apiClient.put(`credentials/${id}`, { json: data }).json<CredentialResponse>();
}

export async function deleteCredential(id: string): Promise<void> {
  await apiClient.delete(`credentials/${id}`);
}

export async function testCredential(id: string): Promise<{ ok: boolean; type: string; name: string }> {
  return apiClient
    .post(`credentials/${id}/test`)
    .json<{ ok: boolean; type: string; name: string }>();
}
