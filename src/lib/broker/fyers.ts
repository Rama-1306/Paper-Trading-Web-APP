import { sha256 } from 'js-sha256';
import axios from 'axios';

const FYERS_API_URL = 'https://api-t1.fyers.in/api/v3';

export class FyersAPI {
  private appId: string;
  private secretKey: string;
  private redirectUri: string;
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.appId = process.env.FYERS_APP_ID || '';
    this.secretKey = process.env.FYERS_SECRET_KEY || '';
    this.redirectUri = process.env.FYERS_REDIRECT_URI || '';
    this.accessToken = accessToken;
  }

  // 1. Generate the Login URL to redirect the user
  getLoginUrl(): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: 'fyers_login',
    });
    return `${FYERS_API_URL}/generate-authcode?${params.toString()}`;
  }

  // 2. Exchange auth_code for access_token
  async validateAuthCode(authCode: string): Promise<string> {
    const appIdHash = sha256(`${this.appId}:${this.secretKey}`);

    const response = await axios.post(`${FYERS_API_URL}/validate-authcode`, {
      grant_type: 'authorization_code',
      appIdHash,
      code: authCode,
    });

    if (response.data?.s === 'ok' && response.data?.access_token) {
      return response.data.access_token;
    }

    throw new Error(response.data?.message || 'Failed to validate auth code');
  }

  // 3. Set access token for subsequent API calls
  setAccessToken(token: string) {
    this.accessToken = token;
  }

  // Helper for authenticated requests
  private async request<T>(method: 'GET' | 'POST', endpoint: string, data?: any): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const response = await axios({
        method,
        url: `${FYERS_API_URL}${endpoint}`,
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`,
        },
        data,
      });

      if (response.data?.s !== 'ok') {
        throw new Error(response.data?.message || 'API Error');
      }

      return response.data as T;
    } catch (error: any) {
      console.error(`Fyers API Error (${endpoint}):`, error.response?.data || error.message);
      throw error;
    }
  }

  // Example API: Get Profile
  async getProfile() {
    return this.request('GET', '/profile');
  }

  // Example API: Get Historical Data (Candles)
  // Format: "NSE:NIFTYBANK-INDEX", resolution: "1", "5", "D", etc.
  async getHistory(symbol: string, resolution: string, dateFrom: string, dateTo: string) {
    const params = new URLSearchParams({
      symbol,
      resolution,
      date_format: '1', // 1 means yyyy-mm-dd format
      range_from: dateFrom,
      range_to: dateTo,
      cont_flag: '1', // Continuous chart
    });

    return this.request<any>('GET', `/history?${params.toString()}`);
  }

  // 4. Get Option Chain
  // Symbol: "NSE:NIFTYBANK-INDEX", strikeCount: number
  async getOptionChain(symbol: string, strikeCount: number = 10) {
    const params = new URLSearchParams({
      symbol,
      strikecount: strikeCount.toString(),
      timestamp: '', // Empty for current expiry
    });

    // Option Chain v3 endpoint is special
    const url = `https://api-t1.fyers.in/data/options-chain-v3?${params.toString()}`;
    
    if (!this.accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `${this.appId}:${this.accessToken}`,
        },
      });

      if (response.data?.s !== 'ok') {
        throw new Error(response.data?.message || 'API Error');
      }

      return response.data;
    } catch (error: any) {
      console.error(`Fyers Option Chain Error:`, error.response?.data || error.message);
      throw error;
    }
  }
}
