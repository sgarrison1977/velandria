import axios from "axios";
import { API } from "@/lib/api";

export const adminHttp = axios.create({ baseURL: API });
adminHttp.interceptors.request.use((c) => {
  const t = sessionStorage.getItem("sx_admin");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
