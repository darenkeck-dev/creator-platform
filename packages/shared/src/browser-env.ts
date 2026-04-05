export class BrowserEnv {
  private static userAgent(): string {
    if (typeof navigator === "undefined") {
      return "";
    }

    return navigator.userAgent;
  }

  private static vendor(): string {
    if (typeof navigator === "undefined") {
      return "";
    }

    return navigator.vendor;
  }

  static isSafari(): boolean {
    const ua = BrowserEnv.userAgent();
    const vendor = BrowserEnv.vendor();
    if (!ua) {
      return false;
    }

    const hasSafariToken = /Safari/i.test(ua);
    const excluded = /Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|SamsungBrowser|Android/i.test(ua);
    const appleVendor = /Apple/i.test(vendor);

    return hasSafariToken && !excluded && appleVendor;
  }

  static isIOS(): boolean {
    const ua = BrowserEnv.userAgent();
    if (!ua && typeof navigator === "undefined") {
      return false;
    }

    if (/iPhone|iPad|iPod/i.test(ua)) {
      return true;
    }

    if (typeof navigator !== "undefined") {
      return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    }

    return false;
  }

  static isIosSafari(): boolean {
    return BrowserEnv.isIOS() && BrowserEnv.isSafari();
  }
}
