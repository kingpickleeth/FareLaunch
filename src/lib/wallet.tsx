// src/lib/wallet.tsx
import '@rainbow-me/rainbowkit/styles.css';
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { defineChain } from 'viem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- ApeChain from env (adjust when you have final values) ----
const APECHAIN_ID = Number(import.meta.env.VITE_APECHAIN_ID || 0);

const APECHAIN = defineChain({
  id: APECHAIN_ID,
  name: import.meta.env.VITE_APECHAIN_NAME || 'ApeChain',
  nativeCurrency: {
    name: import.meta.env.VITE_APECHAIN_SYMBOL || 'WAPE',
    symbol: import.meta.env.VITE_APECHAIN_SYMBOL || 'WAPE',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_APECHAIN_RPC || ''] },
    public: { http: [import.meta.env.VITE_APECHAIN_RPC || ''] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: import.meta.env.VITE_APECHAIN_EXPLORER || '' },
  },
});

// ---- Wagmi + RainbowKit config (v2 style) ----
const config = getDefaultConfig({
  appName: 'FareLaunch',
  projectId: import.meta.env.VITE_WC_PROJECT_ID || 'missing_project_id',
  chains: [APECHAIN],
  transports: {
    [APECHAIN.id]: http(APECHAIN.rpcUrls.default.http[0]),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: 'var(--fl-purple)',
            borderRadius: 'medium',
          })}
          modalSize="compact"
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// Re-export for convenience
export { ConnectButton };
