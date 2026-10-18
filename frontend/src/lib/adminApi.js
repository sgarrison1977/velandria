import axios from "axios";
import { API } from "@/lib/api";

export const adminHttp = axios.create({ baseURL: API });
adminHttp.interceptors.request.use((c) => {
  const t = sessionStorage.getItem("sx_admin");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const fmtDur = (s) => { s = s || 0; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; };
