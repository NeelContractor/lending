'use client'

import { getLendingProgram, getLendingProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import BN from 'bn.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'

interface InitializeUserArgs {
  usdcMint: PublicKey
  signerPubkey: PublicKey
}

interface InitializeBankArgs {
  mint: PublicKey
  signerPubkey: PublicKey
  liquidationThreshold: number
  maxLtv: number
}

interface DepositArgs {
  amount: number
  mint: PublicKey
  signerPubkey: PublicKey
}

interface WithdrawArgs {
  amount: number
  mint: PublicKey
  signerPubkey: PublicKey
}

interface BorrowArgs {
  amount: number
  mint: PublicKey
  signerPubkey: PublicKey
  priceUpdate: PublicKey
}

interface RepayArgs {
  amount: number
  mint: PublicKey
  signerPubkey: PublicKey
}

export function useLendingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getLendingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getLendingProgram(provider, programId), [provider, programId])

  const bankAccounts = useQuery({
    queryKey: ['bank', 'all', { cluster }],
    queryFn: () => program.account.bank.all(),
  })

  const priceUpdateV2Accounts = useQuery({
    queryKey: ['priceUpdateV2', 'all', { cluster }],
    queryFn: () => program.account.priceUpdateV2.all(),
  })

  const userAccounts = useQuery({
    queryKey: ['user', 'all', { cluster }],
    queryFn: () => program.account.user.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initializeUser = useMutation<string, Error, InitializeUserArgs>({
    mutationKey: ['user', 'initialize', { cluster }],
    mutationFn: async ({ usdcMint, signerPubkey }) => {
      return await program.methods
        .initUser(usdcMint)
        .accounts({
          signer: signerPubkey,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await userAccounts.refetch()
    },
    onError: (error) => {
      console.error('Initialize user error:', error)
      toast.error('Failed to initialize user account')
    },
  })

  const initializeBank = useMutation<string, Error, InitializeBankArgs>({
    mutationKey: ['bank', 'initialize', { cluster }],
    mutationFn: async ({ liquidationThreshold, maxLtv, signerPubkey, mint }) => {
      return await program.methods
        .initBank(new BN(liquidationThreshold), new BN(maxLtv))
        .accounts({
          signer: signerPubkey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await bankAccounts.refetch()
    },
    onError: (error) => {
      console.error('Initialize bank error:', error)
      toast.error('Failed to initialize bank account')
    },
  })

  const deposit = useMutation<string, Error, DepositArgs>({
    mutationKey: ['deposit', 'execute', { cluster }],
    mutationFn: async ({ amount, mint, signerPubkey }) => {
      const amountBN = new BN(amount)
      return await program.methods
        .deposit(amountBN)
        .accounts({
          signer: signerPubkey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await userAccounts.refetch()
      await bankAccounts.refetch()
    },
    onError: (error) => {
      console.error('Deposit error:', error)
      toast.error('Failed to deposit tokens')
    },
  })

  const withdraw = useMutation<string, Error, WithdrawArgs>({
    mutationKey: ['withdraw', 'execute', { cluster }],
    mutationFn: async ({ amount, mint, signerPubkey }) => {
      const amountBN = new BN(amount)
      return await program.methods
        .withdraw(amountBN)
        .accounts({
          signer: signerPubkey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await userAccounts.refetch()
      await bankAccounts.refetch()
    },
    onError: (error) => {
      console.error('Withdraw error:', error)
      toast.error('Failed to withdraw tokens')
    },
  })

  const borrow = useMutation<string, Error, BorrowArgs>({
    mutationKey: ['borrow', 'execute', { cluster }],
    mutationFn: async ({ amount, mint, signerPubkey, priceUpdate }) => {
      const amountBN = new BN(amount)
      return await program.methods
        .borrow(amountBN)
        .accounts({
          signer: signerPubkey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          priceUpdate: priceUpdate,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await userAccounts.refetch()
      await bankAccounts.refetch()
    },
    onError: (error) => {
      console.error('Borrow error:', error)
      if (error.message?.includes('AccountNotInitialized')) {
        toast.error('Price feed not available. Please try again later.')
      } else if (error.message?.includes('OverBorrowableAmount')) {
        toast.error('Insufficient collateral to borrow this amount')
      } else {
        toast.error('Failed to borrow tokens')
      }
    },
  })

  const repay = useMutation<string, Error, RepayArgs>({
    mutationKey: ['repay', 'execute', { cluster }],
    mutationFn: async ({ amount, mint, signerPubkey }) => {
      const amountBN = new BN(amount)
      return await program.methods
        .repay(amountBN)
        .accounts({
          signer: signerPubkey,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      transactionToast(signature)
      await userAccounts.refetch()
      await bankAccounts.refetch()
    },
    onError: (error) => {
      console.error('Repay error:', error)
      if (error.message?.includes('OverRepay')) {
        toast.error('Attempting to repay more than borrowed')
      } else {
        toast.error('Failed to repay tokens')
      }
    },
  })

  return {
    program,
    programId,
    bankAccounts,
    priceUpdateV2Accounts,
    userAccounts,
    getProgramAccount,
    initializeUser,
    initializeBank,
    deposit,
    withdraw,
    borrow,
    repay,
  }
}

export function useLendingProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, userAccounts, bankAccounts } = useLendingProgram()

  // Get specific bank account
  const bankAccountQuery = useQuery({
    queryKey: ['bank', 'fetch', { cluster, account }],
    queryFn: () => program.account.bank.fetch(account),
    enabled: !!account,
  })

  // Get specific user account  
  const userAccountQuery = useQuery({
    queryKey: ['user', 'fetch', { cluster, account }],
    queryFn: () => program.account.user.fetch(account),
    enabled: !!account,
  })

  // Helper function to get user PDA
  const getUserPDA = (userPubkey: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [userPubkey.toBuffer()],
      program.programId
    )[0]
  }

  // Helper function to get bank PDA
  const getBankPDA = (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [mint.toBuffer()],
      program.programId
    )[0]
  }

  // Helper function to get treasury PDA
  const getTreasuryPDA = (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), mint.toBuffer()],
      program.programId
    )[0]
  }

  return {
    bankAccountQuery,
    userAccountQuery,
    getUserPDA,
    getBankPDA,
    getTreasuryPDA,
  }
}

// Additional hook for utility functions
export function useLendingUtils() {
  const { cluster } = useCluster()
  const { program } = useLendingProgram()

  // Convert amount to proper decimal places
  const toTokenAmount = (amount: number, decimals: number): BN => {
    return new BN(amount * Math.pow(10, decimals))
  }

  // Convert from token amount to human readable
  const fromTokenAmount = (amount: BN, decimals: number): number => {
    return amount.toNumber() / Math.pow(10, decimals)
  }

  // Calculate health factor (this would need actual implementation based on your contract)
  const calculateHealthFactor = (
    collateralValue: number,
    borrowedValue: number,
    liquidationThreshold: number
  ): number => {
    if (borrowedValue === 0) return Infinity
    return (collateralValue * liquidationThreshold) / borrowedValue
  }

  // Get all PDAs for a user
  const getUserAccounts = (userPubkey: PublicKey, usdcMint: PublicKey, solMint: PublicKey) => {
    const userPDA = PublicKey.findProgramAddressSync(
      [userPubkey.toBuffer()],
      program.programId
    )[0]

    const usdcBankPDA = PublicKey.findProgramAddressSync(
      [usdcMint.toBuffer()],
      program.programId
    )[0]

    const solBankPDA = PublicKey.findProgramAddressSync(
      [solMint.toBuffer()],
      program.programId
    )[0]

    const usdcTreasuryPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), usdcMint.toBuffer()],
      program.programId
    )[0]

    const solTreasuryPDA = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), solMint.toBuffer()],
      program.programId
    )[0]

    return {
      userPDA,
      usdcBankPDA,
      solBankPDA,
      usdcTreasuryPDA,
      solTreasuryPDA,
    }
  }

  // Validate transaction parameters
  const validateDepositAmount = (amount: number, balance: number): boolean => {
    return amount > 0 && amount <= balance
  }

  const validateWithdrawAmount = (amount: number, deposited: number): boolean => {
    return amount > 0 && amount <= deposited
  }

  const validateBorrowAmount = (
    amount: number,
    maxBorrowable: number,
    availableLiquidity: number
  ): boolean => {
    return amount > 0 && amount <= maxBorrowable && amount <= availableLiquidity
  }

  const validateRepayAmount = (amount: number, borrowed: number): boolean => {
    return amount > 0 && amount <= borrowed
  }

  return {
    toTokenAmount,
    fromTokenAmount,
    calculateHealthFactor,
    getUserAccounts,
    validateDepositAmount,
    validateWithdrawAmount,
    validateBorrowAmount,
    validateRepayAmount,
  }
}