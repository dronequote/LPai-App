// src/utils/netinfo.ts
let NetInfo: any;

try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (error) {
  console.log('NetInfo not available, using mock');
  NetInfo = {
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
    addEventListener: (callback: any) => {
      if (callback) callback({ isConnected: true, isInternetReachable: true });
      return { remove: () => {} };
    },
  };
}

export default NetInfo;