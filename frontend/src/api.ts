const BASE_URL = 'http://127.0.0.1:8000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  
  // Set default content type if not uploading form data
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach token if present
  const token = localStorage.getItem('access_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit', // We're using Bearer tokens, not cookies
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Ignore JSON parse errors for non-JSON error responses
    }
    
    if (response.status === 401) {
      // Clear invalid token
      localStorage.removeItem('access_token');
      throw new Error('UNAUTHORIZED');
    }
    
    throw new Error(errorMessage);
  }

  // If it's a 204 No Content, return null
  if (response.status === 204) return null;
  
  return response.json();
}
