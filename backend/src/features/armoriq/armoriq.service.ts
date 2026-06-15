import axios from 'axios';

const ARMORIQ_API_URL = process.env.ARMORIQ_ENDPOINT || process.env.ARMORIQ_API_URL || 'https://api.armoriq.ai/v1';
const ARMORIQ_API_KEY = process.env.ARMORIQ_API_KEY || '';

export class ArmorIQService {
  /**
   * Fetch intent logs from ArmorIQ
   */
  static async getIntentLogs() {
    if (!ARMORIQ_API_KEY) {
      return { status: 'unconfigured', message: 'ArmorIQ API Key not set', logs: [] };
    }
    try {
      const response = await axios.get(`${ARMORIQ_API_URL}/intents/logs`, {
        headers: { Authorization: `Bearer ${ARMORIQ_API_KEY}` }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch ArmorIQ intent logs:', error);
      throw new Error('ArmorIQ service unavailable');
    }
  }

  /**
   * Fetch active policies from ArmorIQ
   */
  static async getPolicies() {
    if (!ARMORIQ_API_KEY) {
      return { status: 'unconfigured', message: 'ArmorIQ API Key not set', policies: [] };
    }
    try {
      const response = await axios.get(`${ARMORIQ_API_URL}/policies`, {
        headers: { Authorization: `Bearer ${ARMORIQ_API_KEY}` }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch ArmorIQ policies:', error);
      throw new Error('ArmorIQ service unavailable');
    }
  }

  /**
   * Verify an action/intent before execution
   */
  static async verifyIntent(actionType: string, payload: any) {
    if (!ARMORIQ_API_KEY || ARMORIQ_API_KEY === 'mock') {
      // In a real scenario, you might want to fail closed. Failing open for now if unconfigured.
      return { allowed: true, reason: 'unconfigured' };
    }

    let endpoint = ARMORIQ_API_URL;
    if (endpoint.endsWith('/')) {
      endpoint = endpoint.slice(0, -1);
    }
    if (endpoint.endsWith('/v1')) {
      endpoint = endpoint.slice(0, -3);
    }

    try {
      const response = await axios.post(`${endpoint}/iap/verify`, {
        action: actionType,
        payload
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ARMORIQ_API_KEY}`,
          'x-api-key': ARMORIQ_API_KEY
        }
      });
      return response.data; // e.g., { allowed: true/false }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.warn('verifyIntent returned 404 — allowing action (custom platform setup or unconfigured endpoint)');
        return { allowed: true, reason: '404 fallback' };
      }
      console.error('Failed to verify intent with ArmorIQ:', error.message || error);
      // Fail secure pattern: block action if ArmorIQ is unreachable or returns other errors
      return { allowed: false, reason: error.response?.data?.error || 'ArmorIQ unreachable' };
    }
  }
}
