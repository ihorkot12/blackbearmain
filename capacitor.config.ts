import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ua.kyiv.shinkarate.admin',
  appName: 'Black Bear Admin',
  webDir: 'dist',
  backgroundColor: '#050505',
  server: {
    url: 'https://shin-karate.kyiv.ua/admin',
    cleartext: false,
    allowNavigation: ['shin-karate.kyiv.ua']
  },
  android: {
    backgroundColor: '#050505'
  },
  ios: {
    backgroundColor: '#050505'
  }
};

export default config;
