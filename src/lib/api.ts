// src/lib/api.ts
import axios from 'axios';
import { API_BASE_URL } from '@env';

console.log('API_BASE_URL:', API_BASE_URL); // Add this line

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export default api;
