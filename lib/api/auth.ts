import { apiClient, APIResponse } from "./client";

export interface LoginResponse {
  token: string;
  payload: {
    user_id: string;
    email: string;
    username: string;
    org_id: string;
    plant_id: string | null;
    role: string;
    exp: number;
  };
}

export const authApi = {
  async login(email: string, password: string): Promise<APIResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>(
      "/api/auth/login",
      { email, password },
      { headers: { Authorization: "" } },
    );
  },

  async logout(token: string): Promise<APIResponse> {
    return apiClient.post("/api/auth/logout", { token });
  },

  async verifyToken(): Promise<APIResponse> {
    return apiClient.post("/api/auth/verify-token");
  },

  async refreshToken(): Promise<APIResponse<LoginResponse>> {
    return apiClient.post<LoginResponse>("/api/auth/refresh-token");
  },
};
