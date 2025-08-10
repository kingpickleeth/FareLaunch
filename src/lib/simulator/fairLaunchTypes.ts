export type BaseSymbol = 'ETH' | 'WETH' | 'APE' | 'USDC';

export type FairLaunchInput = {
  token: {
    symbol: string;
    totalSupply: number; // human units, e.g., 1_000_000
  };
  base: {
    symbol: BaseSymbol;  // label only
  };
  economics: {
    totalRaised: number;            // in base currency
    pctTokensToLP: number;          // % of total supply
    pctRaiseToLP: number;           // % of raised funds
    pctWithholdOfRemaining: number; // % of remaining (after LP tokens) to withhold
  };
};

export type FairLaunchResult = {
  tokensToLP: number;
  tokensWithheld: number;
  tokensForPresale: number;
  baseToLP: number;
  creatorProceeds: number;
  listingPrice: number;   // base per token
  presalePrice: number;   // base per token
  openingFDV: number;     // in base currency
};
