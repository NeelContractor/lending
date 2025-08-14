"use client"

import { useState, useMemo } from "react";
import { useLendingProgram, useLendingUtils } from "./lending-data-access";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { toast } from "sonner";
import { WalletButton } from "../solana/solana-provider";

// Mock mint addresses - replace with actual mint addresses
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mainnet
const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112"); // Wrapped SOL

// Mock Pyth price feed - replace with actual price feed
const SOL_PRICE_FEED = new PublicKey("H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG");

interface TokenInfo {
  symbol: string;
  mint: PublicKey;
  decimals: number;
  icon?: string;
}

const SUPPORTED_TOKENS: TokenInfo[] = [
  { symbol: "USDC", mint: USDC_MINT, decimals: 6, icon: "💰" },
  { symbol: "SOL", mint: SOL_MINT, decimals: 9, icon: "◎" },
];

export default function Lending() {
  const { 
    userAccounts, 
    bankAccounts, 
    priceUpdateV2Accounts, 
    initializeBank, 
    initializeUser, 
    deposit, 
    withdraw, 
    borrow,
    repay 
  } = useLendingProgram();
  
  const { 
    toTokenAmount, 
    fromTokenAmount, 
    calculateHealthFactor,
    validateDepositAmount,
    validateWithdrawAmount,
    validateBorrowAmount,
    validateRepayAmount
  } = useLendingUtils();
  
  const { publicKey, connected } = useWallet();

  // State for modals and forms
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>('supply');
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(SUPPORTED_TOKENS[0]);
  const [amount, setAmount] = useState<string>("");
  const [showInitModal, setShowInitModal] = useState(false);

  // Get user and bank data
  const userAccount = useMemo(() => {
    if (!publicKey || !userAccounts.data) return null;
    return userAccounts.data.find(acc => 
      acc.account.owner.equals(publicKey)
    );
  }, [publicKey, userAccounts.data]);

  const bankData = useMemo(() => {
    if (!bankAccounts.data) return {};
    return bankAccounts.data.reduce((acc, bank) => {
      acc[bank.account.mintAddress.toString()] = bank.account;
      return acc;
    }, {} as Record<string, any>);
  }, [bankAccounts.data]);

  // Calculate user stats
  const userStats = useMemo(() => {
    if (!userAccount) return null;
    
    const usdcDeposited = fromTokenAmount(userAccount.account.depositedUsdc, 6);
    const solDeposited = fromTokenAmount(userAccount.account.depositedSol, 9);
    const usdcBorrowed = fromTokenAmount(userAccount.account.borrowedUsdc, 6);
    const solBorrowed = fromTokenAmount(userAccount.account.borrowedSol, 9);
    
    // Mock prices - in production, get from Pyth or other oracle
    const usdcPrice = 1; // $1
    const solPrice = 100; // $100
    
    const totalSupplied = (usdcDeposited * usdcPrice) + (solDeposited * solPrice);
    const totalBorrowed = (usdcBorrowed * usdcPrice) + (solBorrowed * solPrice);
    const healthFactor = calculateHealthFactor(totalSupplied, totalBorrowed, 0.8);
    
    return {
      totalSupplied,
      totalBorrowed,
      healthFactor,
      usdcDeposited,
      solDeposited,
      usdcBorrowed,
      solBorrowed
    };
  }, [userAccount, calculateHealthFactor, fromTokenAmount]);

  const handleInitializeUser = async () => {
    if (!publicKey) return;
    
    try {
      await initializeUser.mutateAsync({
        usdcMint: USDC_MINT,
        signerPubkey: publicKey
      });
      setShowInitModal(false);
      toast.success("User account initialized successfully!");
    } catch (error) {
      console.error("Failed to initialize user:", error);
    }
  };

  const handleInitializeBank = async (token: TokenInfo) => {
    if (!publicKey) return;
    
    try {
      await initializeBank.mutateAsync({
        mint: token.mint,
        signerPubkey: publicKey,
        liquidationThreshold: 80, // 80%
        maxLtv: 75 // 75%
      });
      toast.success(`${token.symbol} bank initialized successfully!`);
    } catch (error) {
      console.error("Failed to initialize bank:", error);
    }
  };

  const handleSupplyAction = async () => {
    if (!publicKey || !amount) return;
    
    const amountNum = parseFloat(amount);
    const tokenAmount = toTokenAmount(amountNum, selectedToken.decimals);
    
    try {
      await deposit.mutateAsync({
        amount: tokenAmount.toNumber(),
        mint: selectedToken.mint,
        signerPubkey: publicKey
      });
      setAmount("");
      toast.success(`Supplied ${amount} ${selectedToken.symbol} successfully!`);
    } catch (error) {
      console.error("Supply failed:", error);
    }
  };

  const handleWithdrawAction = async () => {
    if (!publicKey || !amount) return;
    
    const amountNum = parseFloat(amount);
    const tokenAmount = toTokenAmount(amountNum, selectedToken.decimals);
    
    try {
      await withdraw.mutateAsync({
        amount: tokenAmount.toNumber(),
        mint: selectedToken.mint,
        signerPubkey: publicKey
      });
      setAmount("");
      toast.success(`Withdrew ${amount} ${selectedToken.symbol} successfully!`);
    } catch (error) {
      console.error("Withdraw failed:", error);
    }
  };

  const handleBorrowAction = async () => {
    if (!publicKey || !amount) return;
    
    const amountNum = parseFloat(amount);
    const tokenAmount = toTokenAmount(amountNum, selectedToken.decimals);
    
    try {
      await borrow.mutateAsync({
        amount: tokenAmount.toNumber(),
        mint: selectedToken.mint,
        signerPubkey: publicKey,
        priceUpdate: SOL_PRICE_FEED // You'll need to determine this dynamically
      });
      setAmount("");
      toast.success(`Borrowed ${amount} ${selectedToken.symbol} successfully!`);
    } catch (error) {
      console.error("Borrow failed:", error);
    }
  };

  const handleRepayAction = async () => {
    if (!publicKey || !amount) return;
    
    const amountNum = parseFloat(amount);
    const tokenAmount = toTokenAmount(amountNum, selectedToken.decimals);
    
    try {
      await repay.mutateAsync({
        amount: tokenAmount.toNumber(),
        mint: selectedToken.mint,
        signerPubkey: publicKey
      });
      setAmount("");
      toast.success(`Repaid ${amount} ${selectedToken.symbol} successfully!`);
    } catch (error) {
      console.error("Repay failed:", error);
    }
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Solana Lending Protocol</h2>
          <p className="text-lg opacity-80 mb-6">Connect your wallet to start lending and borrowing</p>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center">
            <span className="text-2xl">🏦</span>
          </div>
          <div>
            <WalletButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Solana Lending Protocol</h1>
          <p className="text-white/70">Supply assets to earn interest or borrow against your collateral</p>
          <WalletButton />
        </div>

        {/* User Stats Dashboard */}
        {userStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white">
              <h3 className="text-sm font-medium text-white/70 mb-1">Total Supplied</h3>
              <p className="text-2xl font-bold">${userStats.totalSupplied.toFixed(2)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white">
              <h3 className="text-sm font-medium text-white/70 mb-1">Total Borrowed</h3>
              <p className="text-2xl font-bold">${userStats.totalBorrowed.toFixed(2)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white">
              <h3 className="text-sm font-medium text-white/70 mb-1">Health Factor</h3>
              <p className={`text-2xl font-bold ${userStats.healthFactor > 1.5 ? 'text-green-400' : userStats.healthFactor > 1.2 ? 'text-yellow-400' : 'text-red-400'}`}>
                {userStats.healthFactor === Infinity ? '∞' : userStats.healthFactor.toFixed(2)}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white">
              <h3 className="text-sm font-medium text-white/70 mb-1">Available to Borrow</h3>
              <p className="text-2xl font-bold">${(userStats.totalSupplied * 0.75 - userStats.totalBorrowed).toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Initialize User Modal */}
        {!userAccount && (
          <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-2xl p-6 mb-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Account Setup Required</h3>
            <p className="text-white/70 mb-4">Initialize your user account to start using the lending protocol</p>
            <button 
              onClick={handleInitializeUser}
              disabled={initializeUser.isPending}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
            >
              {initializeUser.isPending ? 'Initializing...' : 'Initialize Account'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Action Panel */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6">
            {/* Tab Navigation */}
            <div className="flex bg-white/10 rounded-2xl p-1 mb-6">
              <button 
                onClick={() => setActiveTab('supply')}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                  activeTab === 'supply' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Supply
              </button>
              <button 
                onClick={() => setActiveTab('borrow')}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                  activeTab === 'borrow' 
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Borrow
              </button>
            </div>

            {/* Token Selection */}
            <div className="mb-6">
              <label className="block text-white/70 text-sm font-medium mb-3">Select Asset</label>
              <div className="grid grid-cols-2 gap-3">
                {SUPPORTED_TOKENS.map((token) => (
                  <button
                    key={token.symbol}
                    onClick={() => setSelectedToken(token)}
                    className={`p-4 rounded-2xl border transition-all ${
                      selectedToken.symbol === token.symbol
                        ? 'border-purple-400 bg-purple-500/20'
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-2xl mb-2">{token.icon}</div>
                    <div className="text-white font-semibold">{token.symbol}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-white/70 text-sm font-medium mb-3">
                {activeTab === 'supply' ? 'Supply Amount' : 'Borrow Amount'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-white placeholder-white/40 focus:border-purple-400 focus:outline-none transition-all"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/70">
                  {selectedToken.symbol}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {activeTab === 'supply' ? (
                <>
                  <button 
                    onClick={handleSupplyAction}
                    disabled={!amount || deposit.isPending}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-4 rounded-2xl font-semibold hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {deposit.isPending ? 'Supplying...' : `Supply ${selectedToken.symbol}`}
                  </button>
                  <button 
                    onClick={handleWithdrawAction}
                    disabled={!amount || withdraw.isPending}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 rounded-2xl font-semibold hover:from-red-600 hover:to-pink-600 disabled:opacity-50 transition-all"
                  >
                    {withdraw.isPending ? 'Withdrawing...' : `Withdraw ${selectedToken.symbol}`}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleBorrowAction}
                    disabled={!amount || borrow.isPending}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-2xl font-semibold hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
                  >
                    {borrow.isPending ? 'Borrowing...' : `Borrow ${selectedToken.symbol}`}
                  </button>
                  <button 
                    onClick={handleRepayAction}
                    disabled={!amount || repay.isPending}
                    className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white py-4 rounded-2xl font-semibold hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all"
                  >
                    {repay.isPending ? 'Repaying...' : `Repay ${selectedToken.symbol}`}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Markets Overview */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Markets</h3>
            <div className="space-y-4">
              {SUPPORTED_TOKENS.map((token) => {
                const bankInfo = bankData[token.mint.toString()];
                return (
                  <div key={token.symbol} className="bg-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{token.icon}</div>
                        <div>
                          <div className="text-white font-semibold">{token.symbol}</div>
                          <div className="text-white/50 text-sm">
                            {bankInfo ? 'Active' : 'Not initialized'}
                          </div>
                        </div>
                      </div>
                      {!bankInfo && (
                        <button
                          onClick={() => handleInitializeBank(token)}
                          disabled={initializeBank.isPending}
                          className="bg-purple-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-purple-600 disabled:opacity-50 transition-all"
                        >
                          Initialize
                        </button>
                      )}
                    </div>
                    
                    {bankInfo && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-white/70">Supply APY</div>
                          <div className="text-green-400 font-semibold">
                            {(fromTokenAmount(bankInfo.interestRate, 2) * 100).toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70">Borrow APY</div>
                          <div className="text-red-400 font-semibold">
                            {(fromTokenAmount(bankInfo.interestRate, 2) * 120).toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70">Total Supplied</div>
                          <div className="text-white font-semibold">
                            {fromTokenAmount(bankInfo.totalDeposits, token.decimals).toFixed(2)} {token.symbol}
                          </div>
                        </div>
                        <div>
                          <div className="text-white/70">Total Borrowed</div>
                          <div className="text-white font-semibold">
                            {fromTokenAmount(bankInfo.totalBorrowed, token.decimals).toFixed(2)} {token.symbol}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* User Positions */}
        {userAccount && (
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-3xl p-6">
            <h3 className="text-xl font-bold text-white mb-6">Your Positions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplied */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Supplied Assets</h4>
                <div className="space-y-3">
                  {userStats && userStats.usdcDeposited > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">💰</div>
                        <div>
                          <div className="text-white font-semibold">USDC</div>
                          <div className="text-white/70 text-sm">Earning 5.2% APY</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{userStats.usdcDeposited.toFixed(2)} USDC</div>
                        <div className="text-green-400 text-sm">${userStats.usdcDeposited.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {userStats && userStats.solDeposited > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">◎</div>
                        <div>
                          <div className="text-white font-semibold">SOL</div>
                          <div className="text-white/70 text-sm">Earning 3.8% APY</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{userStats.solDeposited.toFixed(4)} SOL</div>
                        <div className="text-green-400 text-sm">${(userStats.solDeposited * 100).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Borrowed */}
              <div>
                <h4 className="text-lg font-semibold text-white mb-4">Borrowed Assets</h4>
                <div className="space-y-3">
                  {userStats && userStats.usdcBorrowed > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">💰</div>
                        <div>
                          <div className="text-white font-semibold">USDC</div>
                          <div className="text-white/70 text-sm">Paying 6.8% APY</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{userStats.usdcBorrowed.toFixed(2)} USDC</div>
                        <div className="text-red-400 text-sm">${userStats.usdcBorrowed.toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                  {userStats && userStats.solBorrowed > 0 && (
                    <div className="bg-white/5 rounded-2xl p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="text-xl">◎</div>
                        <div>
                          <div className="text-white font-semibold">SOL</div>
                          <div className="text-white/70 text-sm">Paying 4.9% APY</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{userStats.solBorrowed.toFixed(4)} SOL</div>
                        <div className="text-red-400 text-sm">${(userStats.solBorrowed * 100).toFixed(2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}