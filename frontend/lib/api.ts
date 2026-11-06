/**
 * API client — all backend calls route through this module.
 * API keys are NEVER stored on the frontend.
 */
import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private client: AxiosInstance;
  private static TOKEN_KEY = "roamly_access_token";

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE}/api`,
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });

    // Request interceptor — attach auth token
    this.client.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Do not clear Firebase auth state on an API 401. An API permission or
    // backend availability error is not equivalent to signing out of Firebase.
    this.client.interceptors.response.use(
      (res) => res,
      (error: AxiosError) => Promise.reject(this.normalizeError(error))
    );
  }

  private normalizeError(error: AxiosError): Error {
    const detail = (error.response?.data as any)?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : error.message || "An unexpected error occurred";
    return new Error(message);
  }

  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ApiClient.TOKEN_KEY);
  }

  setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(ApiClient.TOKEN_KEY, token);
    }
  }

  clearToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ApiClient.TOKEN_KEY);
      localStorage.removeItem("roamly_refresh_token");
      localStorage.removeItem("roamly_user");
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // ── Auth ────────────────────────────────────────────────
  async register(email: string, password: string, fullName: string) {
    const res = await this.client.post("/auth/register", {
      email,
      password,
      full_name: fullName,
    });
    this.setToken(res.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("roamly_refresh_token", res.data.refresh_token);
      localStorage.setItem("roamly_user", JSON.stringify({
        id: res.data.user_id,
        email: res.data.email,
        full_name: res.data.full_name,
      }));
    }
    return res.data;
  }

  async login(email: string, password: string) {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);
    const res = await this.client.post("/auth/login", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    this.setToken(res.data.access_token);
    if (typeof window !== "undefined") {
      localStorage.setItem("roamly_refresh_token", res.data.refresh_token);
      localStorage.setItem("roamly_user", JSON.stringify({
        id: res.data.user_id,
        email: res.data.email,
        full_name: res.data.full_name,
      }));
    }
    return res.data;
  }

  async logout() {
    const refreshToken = typeof window !== "undefined"
      ? localStorage.getItem("roamly_refresh_token")
      : null;
    if (refreshToken) {
      await this.client.post("/auth/logout", { refresh_token: refreshToken }).catch(() => {});
    }
    this.clearToken();
  }

  getLocalUser() {
    if (typeof window === "undefined") return null;
    const u = localStorage.getItem("roamly_user");
    return u ? JSON.parse(u) : null;
  }

  // ── Users ────────────────────────────────────────────────
  async getMe() {
    const res = await this.client.get("/users/me");
    return res.data;
  }

  async updateProfile(data: { full_name?: string; avatar_url?: string }) {
    const res = await this.client.patch("/users/me", data);
    return res.data;
  }

  async getPreferences() {
    const res = await this.client.get("/users/me/preferences");
    return res.data;
  }

  async updatePreferences(data: Record<string, any>) {
    const res = await this.client.patch("/users/me/preferences", data);
    return res.data;
  }

  // ── Destinations ─────────────────────────────────────────
  async getDestinations(params?: Record<string, any>) {
    const res = await this.client.get("/destinations", { params });
    return res.data;
  }

  async getPopularDestinations(limit = 8) {
    const res = await this.client.get("/destinations/popular", { params: { limit } });
    return res.data;
  }

  getPlaceImageUrl(imageUrl?: string): string {
    if (!imageUrl) return "";
    try {
      const url = new URL(imageUrl);
      const photoReference = url.searchParams.get("photo_reference");
      if (photoReference) {
        return `${API_BASE}/api/places/photo?photo_reference=${encodeURIComponent(photoReference)}`;
      }
    } catch {
      // Keep relative and other provider URLs unchanged.
    }
    return imageUrl;
  }

  async getDestination(slug: string) {
    const res = await this.client.get(`/destinations/${slug}`);
    return res.data;
  }

  async getSimilarDestinations(id: string, limit = 4) {
    const res = await this.client.get(`/destinations/${id}/recommendations`, { params: { limit } });
    return res.data;
  }

  // Recommendations handled below under Tourism Data & Recommendations

  // ── Trips ────────────────────────────────────────────────
  async getTrips(params?: Record<string, any>) {
    const res = await this.client.get("/trips", { params });
    return res.data;
  }

  async getTrip(id: string) {
    const res = await this.client.get(`/trips/${id}`);
    return res.data;
  }

  async createTrip(data: Record<string, any>) {
    const res = await this.client.post("/trips", data);
    return res.data;
  }

  async updateTrip(id: string, data: Record<string, any>) {
    const res = await this.client.patch(`/trips/${id}`, data);
    return res.data;
  }

  async deleteTrip(id: string) {
    const res = await this.client.delete(`/trips/${id}`);
    return res.data;
  }

  async generateItinerary(tripId: string, data: Record<string, any>) {
    const res = await this.client.post(`/trips/${tripId}/generate`, data);
    return res.data;
  }

  async shareTrip(tripId: string) {
    const res = await this.client.post(`/trips/${tripId}/share`);
    return res.data;
  }

  async updateActivity(tripId: string, activityId: string, data: Record<string, any>) {
    const res = await this.client.patch(`/trips/${tripId}/activities/${activityId}`, data);
    return res.data;
  }

  async deleteActivity(tripId: string, activityId: string) {
    const res = await this.client.delete(`/trips/${tripId}/activities/${activityId}`);
    return res.data;
  }

  // ── Chat ─────────────────────────────────────────────────
  async createChatSession(title?: string) {
    const res = await this.client.post("/chat/sessions", { title });
    return res.data;
  }

  async getChatSessions() {
    const res = await this.client.get("/chat/sessions");
    return res.data;
  }

  async getChatSession(id: string) {
    const res = await this.client.get(`/chat/sessions/${id}`);
    return res.data;
  }

  async extractTripParameters(message: string) {
    const res = await this.client.post("/chat/extract-parameters", { message });
    return res.data;
  }

  async quickPlan(params: {
    destination: string;
    duration_days?: number;
    budget?: number;
    currency?: string;
    travelers?: string;
    interests?: string[];
  }) {
    const res = await this.client.post("/chat/quick-plan", params);
    return res.data;
  }

  // SSE streaming — returns EventSource URL (used directly on frontend)
  getChatStreamUrl(): string {
    return `${API_BASE}/api/chat/messages/stream`;
  }

  getStreamHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ── Saved ────────────────────────────────────────────────
  async getMyDocuments() { return (await this.client.get("/user/documents")).data; }
  async askMyDocument(documentId: string, message: string) {
    // Gemini may take up to 45 seconds to generate the grounded answer.
    return (await this.client.post(`/user/documents/${documentId}/ask`, { message }, { timeout: 60000 })).data;
  }
  async askRoamly(message: string, includePersonalDocuments = true) { return (await this.client.post("/chat/ask", { message, include_personal_documents: includePersonalDocuments })).data; }
  async getAccessibleDocument(id: string) { return (await this.client.get(`/documents/${id}`)).data; }
  async uploadMyDocument(file: File, metadata: Record<string, string>, onProgress?: (value: number) => void) {
    const form = new FormData(); form.append("file", file);
    Object.entries(metadata).forEach(([key, value]) => { if (value) form.append(key, value); });
    return (await this.client.post("/user/documents/upload", form, { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: e => onProgress?.(e.total ? Math.round(e.loaded * 100 / e.total) : 0) })).data;
  }
  async deleteMyDocument(id: string) { return (await this.client.delete(`/user/documents/${id}`)).data; }
  async reprocessMyDocument(id: string) { return (await this.client.post(`/user/documents/${id}/reprocess`)).data; }
  async downloadMyDocument(id: string) { return (await this.client.get(`/user/documents/${id}/download`, { responseType: "blob" })).data as Blob; }
  async getMyDocument(id: string) { return (await this.client.get(`/user/documents/${id}`)).data; }
  async getAdminDocuments() { return (await this.client.get("/admin/documents")).data; }
  async getAdminUserUploads() { return (await this.client.get("/admin/documents/user-uploads")).data; }
  async getAdminProcessingHistory() { return (await this.client.get("/admin/documents/processing-history")).data; }
  async getAdminDocument(id: string) { return (await this.client.get(`/admin/documents/${id}`)).data; }
  async getAdminDocumentStats() { return (await this.client.get("/admin/documents/stats")).data; }
  async uploadAdminDocument(file: File, metadata: Record<string, string>, onProgress?: (value: number) => void) {
    const form = new FormData(); form.append("file", file);
    Object.entries(metadata).forEach(([key, value]) => { if (value) form.append(key, value); });
    return (await this.client.post("/admin/documents/upload", form, { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: e => onProgress?.(e.total ? Math.round(e.loaded * 100 / e.total) : 0) })).data;
  }
  async deleteAdminDocument(id: string) { return (await this.client.delete(`/admin/documents/${id}`)).data; }
  async downloadAdminDocument(id: string) { return (await this.client.get(`/admin/documents/${id}/download`, { responseType: "blob" })).data as Blob; }
  async reprocessAdminDocument(id: string) { return (await this.client.post(`/admin/documents/${id}/reprocess`)).data; }

  // ── Saved ────────────────────────────────────────────────
  async getSavedItems(itemType?: string) {
    const res = await this.client.get("/saved", {
      params: itemType ? { item_type: itemType } : undefined,
    });
    return res.data;
  }

  async saveItem(data: Record<string, any>) {
    const res = await this.client.post("/saved", data);
    return res.data;
  }

  async removeSavedItem(id: string) {
    const res = await this.client.delete(`/saved/${id}`);
    return res.data;
  }

  // ── Search ────────────────────────────────────────────────
  async search(query: string, types?: string) {
    const res = await this.client.get("/search", {
      params: { q: query, types },
    });
    return res.data;
  }

  async searchWeb(params: {
    q: string;
    location?: string;
    category?: string;
    language?: string;
    country?: string;
    limit?: number;
  }) {
    const res = await this.client.get("/search/web", { params });
    return res.data;
  }

  // ── Weather ──────────────────────────────────────────────
  async getWeather(lat: number, lon: number) {
    const res = await this.client.get("/weather/current", { params: { lat, lon } });
    return res.data;
  }

  // ── Maps ─────────────────────────────────────────────────
  async getDirections(origin: string, destination: string, mode = "driving") {
    const res = await this.client.get("/maps/directions", {
      params: { origin, destination, mode },
    });
    return res.data;
  }

  async geocode(address: string) {
    const res = await this.client.get("/maps/geocode", { params: { address } });
    return res.data;
  }

  // ── Voice ────────────────────────────────────────────────
  async transcribeAudio(audioBlob: Blob, language = "en") {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("language", language);
    const res = await this.client.post("/voice/transcribe", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }

  // ── Tourism Data & Recommendations ───────────────────────
  async searchDestinations(params?: { q?: string; city?: string; country?: string; limit?: number }) {
    const res = await this.client.get("/search/destinations", { params });
    return res.data;
  }

  async searchAttractions(params?: { q?: string; city?: string; lat?: number; lng?: number; min_rating?: number; open_now?: boolean; limit?: number }) {
    const res = await this.client.get("/search/attractions", { params });
    return res.data;
  }

  async searchRestaurants(params?: { q?: string; city?: string; lat?: number; lng?: number; price_level?: number; min_rating?: number; open_now?: boolean; limit?: number }) {
    const res = await this.client.get("/search/restaurants", { params });
    return res.data;
  }

  async searchHotels(params?: {
    query?: string;
    city?: string;
    country?: string;
    min_price?: number;
    max_price?: number;
    min_rating?: number;
    min_review_count?: number;
    amenity?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const res = await this.client.get("/hotels", { params });
    return res.data;
  }

  async getHotel(hotelId: string, enrich = false) {
    const res = await this.client.get(`/hotels/${hotelId}`, { params: { enrich } });
    return res.data;
  }

  async getHotelRecommendations(params: {
    destination?: string;
    city?: string;
    country?: string;
    budget?: number;
    travelers?: number;
    travel_style?: string;
    amenities?: string;
    min_rating?: number;
    saved_hotels?: string;
    limit?: number;
  }) {
    const res = await this.client.get("/hotels/recommendations", { params });
    return res.data;
  }

  async getNearbyHotels(params: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    radius_km?: number;
    limit?: number;
  }) {
    const res = await this.client.get("/hotels/nearby", { params });
    return res.data;
  }

  async compareHotels(hotelIds: string[]) {
    const res = await this.client.get("/hotels/compare", {
      params: { hotel_ids: hotelIds.join(",") },
    });
    return res.data;
  }

  async enrichHotel(hotelId: string, checkIn?: string, checkOut?: string, adults = 2) {
    const res = await this.client.post(`/hotels/${hotelId}/enrich`, null, {
      params: { check_in: checkIn, check_out: checkOut, adults },
    });
    return res.data;
  }

  async addHotelToTrip(tripId: string, data: { hotel_id: string; day_number?: number; notes?: string; custom_price?: number }) {
    const res = await this.client.post(`/trips/${tripId}/hotel`, data);
    return res.data;
  }

  async getTripHotelRecommendations(tripId: string, limit = 5) {
    const res = await this.client.get(`/trips/${tripId}/hotels/recommendations`, { params: { limit } });
    return res.data;
  }

  async ingestHotels(filePath?: string) {
    const res = await this.client.post("/admin/ingest/hotels", null, { params: { file_path: filePath } });
    return res.data;
  }

  async getHotelIngestionStatus() {
    const res = await this.client.get("/admin/ingest/hotels/status");
    return res.data;
  }

  async searchActivities(params?: { q?: string; city?: string; lat?: number; lng?: number; limit?: number }) {
    const res = await this.client.get("/search/activities", { params });
    return res.data;
  }

  async getPlaceDetails(placeId: string) {
    const res = await this.client.get(`/places/${placeId}`);
    return res.data;
  }

  async getNearbyPlaces(params: { lat: number; lng: number; radius_km?: number; category?: string; limit?: number }) {
    const res = await this.client.get("/places/nearby", { params });
    return res.data;
  }

  async getHotelOffers(params: { city: string; check_in?: string; check_out?: string; adults?: number; room_quantity?: number; price_max?: number; limit?: number }) {
    const res = await this.client.get("/hotels/offers", { params });
    return res.data;
  }

  async getEvents(params: { city: string; query?: string; limit?: number }) {
    const res = await this.client.get("/events", { params });
    return res.data;
  }

  async getRoute(params: { origin: string; destination: string; mode?: string; waypoints?: string }) {
    const res = await this.client.get("/maps/route", { params });
    return res.data;
  }

  async getRecommendations(params?: number | { destination?: string; interests?: string; budget?: number; limit?: number }) {
    const queryParams = typeof params === "number" ? { limit: params } : params;
    const res = await this.client.get("/recommendations", { params: queryParams });
    return res.data;
  }

  async recordRecommendationFeedback(placeId: string, action: string) {
    const res = await this.client.post("/recommendations/feedback", { place_id: placeId, action });
    return res.data;
  }

  async recordRecommendationImpression(placeId: string) {
    const res = await this.client.post("/recommendations/impression", { place_id: placeId });
    return res.data;
  }

  // ── Admin ────────────────────────────────────────────────
  async getAdminStats() {
    const res = await this.client.get("/admin/stats");
    return res.data;
  }

  async runIngestion(directoryPath = "data/processed") {
    const res = await this.client.post("/admin/ingestion/run", null, {
      params: { directory_path: directoryPath },
    });
    return res.data;
  }

  async getIngestionStatus() {
    const res = await this.client.get("/admin/ingestion/status");
    return res.data;
  }

  async getIngestionErrors() {
    const res = await this.client.get("/admin/ingestion/errors");
    return res.data;
  }

  async ingestDestinations(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.client.post("/admin/ingest/destinations", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  }
}

export const api = new ApiClient();
export default api;
