/**
 * A small client for the Hibira Push device API (Beams-compatible), for
 * React Native apps that get their APNs or FCM token from expo-notifications.
 *
 * The native SDKs (hibira-push-android, hibira-push-ios) do the same for
 * Kotlin/Java and Swift apps; this file is all a React Native app needs.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Platform = 'apns' | 'fcm';

export interface Options {
  instanceId: string;
  /** The push API base URL from the app page in the portal. */
  endpoint?: string;
}

interface Stored {
  platform: Platform;
  deviceId: string;
  token: string;
}

const STORAGE_KEY = 'hibira-push-device';

export class HibiraPush {
  private readonly base: string;
  private device: Stored | null = null;

  constructor({ instanceId, endpoint = 'https://ws.hibira.io' }: Options) {
    this.base = `${endpoint.replace(/\/$/, '')}/device_api/v1/instances/${encodeURIComponent(instanceId)}`;
  }

  get deviceId(): string | null {
    return this.device?.deviceId ?? null;
  }

  /**
   * Registers this device, or updates its token if it registered before.
   * Call it on every app start with the current native token.
   */
  async start(platform: Platform, token: string, bundleIdentifier?: string): Promise<string> {
    const saved = await this.load();

    if (saved && saved.platform === platform) {
      if (saved.token === token) {
        this.device = saved;
        return saved.deviceId;
      }
      const res = await this.request('PUT', `/devices/${platform}/${saved.deviceId}/token`, { token });
      if (res.ok) {
        await this.save({ ...saved, token });
        return saved.deviceId;
      }
      // 404: the device was deleted (for example the token was reported
      // dead). Register again below, carrying its interests over.
    }

    const res = await this.request('POST', `/devices/${platform}`, {
      token,
      bundleIdentifier,
      metadata: { sdkVersion: 'hibira-react-native-example' },
      knownPreviousClientIds: saved ? [saved.deviceId] : [],
    });
    const body = (await res.json()) as { id: string };
    await this.save({ platform, deviceId: body.id, token });
    return body.id;
  }

  async getInterests(): Promise<string[]> {
    const res = await this.request('GET', `/devices/${this.path()}/interests`);
    const body = (await res.json()) as { interests?: string[] };
    return body.interests ?? [];
  }

  async setInterests(interests: string[]): Promise<void> {
    await this.request('PUT', `/devices/${this.path()}/interests`, { interests });
  }

  async addInterest(interest: string): Promise<void> {
    await this.request('POST', `/devices/${this.path()}/interests/${encodeURIComponent(interest)}`);
  }

  async removeInterest(interest: string): Promise<void> {
    await this.request('DELETE', `/devices/${this.path()}/interests/${encodeURIComponent(interest)}`);
  }

  /**
   * Links the device to a signed-in user, so publishToUsers reaches it.
   * The token comes from your backend (generateToken in the server SDKs, or
   * the hibira-io/laravel token route) and proves the user is signed in.
   */
  async setUserId(userToken: string): Promise<void> {
    await this.request('PUT', `/devices/${this.path()}/user`, undefined, userToken);
  }

  /** Unregisters the device, for example on sign-out. */
  async stop(): Promise<void> {
    if (this.device) {
      await this.request('DELETE', `/devices/${this.path()}`).catch(() => undefined);
    }
    this.device = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  private path(): string {
    if (!this.device) {
      throw new Error('Call start() first');
    }
    return `${this.device.platform}/${this.device.deviceId}`;
  }

  private async request(method: string, path: string, body?: unknown, bearer?: string): Promise<Response> {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok && res.status !== 404) {
      let detail = '';
      try {
        const err = (await res.json()) as { description?: string };
        detail = err.description ? `: ${err.description}` : '';
      } catch {
        // not JSON
      }
      throw new Error(`Hibira Push ${method} ${path} failed with ${res.status}${detail}`);
    }
    return res;
  }

  private async load(): Promise<Stored | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  }

  private async save(device: Stored): Promise<void> {
    this.device = device;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(device));
  }
}
