// Global variables
let provider = null;
let signer = null;
let userAccount = null;
let currentWalletType = null;
let walletConnectProvider = null;

// Wallet configurations
const WALLET_TYPES = {
    METAMASK: 'metamask',
    WALLETCONNECT: 'walletconnect',
    COINBASE: 'coinbase',
    TRUST: 'trust',
    OKX: 'okx',
    BITGET: 'bitget',
    PHANTOM: 'phantom'
};

// DOM elements - will be initialized after DOM loads
let connectBtn, disconnectBtn, walletModal, walletInfo, walletDetails, connectionStatus, walletType, walletAddress, ethBalance;
let networkName, nftGrid, nftLoading, noNftsMessage, darkModeToggle, darkModeIcon;
let nftSection, refreshNftsBtn, copyAddressBtn, refreshBalanceBtn;
let errorToast, successToast, errorMessage, successMessage, closeModal;

// EIP-6963 discovery store
let eip6963Providers = [];

// Wallet detection functions (return explicit booleans). Includes EIP-6963 providers.
const walletDetectors = {
    metamask: () => {
        const byWindow = !!(window.ethereum && (
            window.ethereum.isMetaMask ||
            (window.ethereum.providers && window.ethereum.providers.some(p => p.isMetaMask))
        ));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isMetaMask || /metamask/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    },
    coinbase: () => {
        const byWindow = !!((window.ethereum && window.ethereum.isCoinbaseWallet) ||
               window.coinbaseWalletExtension ||
               (window.ethereum && window.ethereum.providers && window.ethereum.providers.some(p => p.isCoinbaseWallet)));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isCoinbaseWallet || /coinbase/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    },
    trust: () => {
        const byWindow = !!((window.ethereum && window.ethereum.isTrust) ||
               window.trustwallet ||
               (window.ethereum && window.ethereum.providers && window.ethereum.providers.some(p => p.isTrust)));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isTrust || /trust\s*wallet/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    },
    okx: () => {
        const byWindow = !!(window.okxwallet ||
               window.okex ||
               (window.ethereum && (window.ethereum.isOKExWallet || window.ethereum.isOkxWallet || window.ethereum.isOKX)) ||
               (window.ethereum && window.ethereum.providers && window.ethereum.providers.some(p => 
                   p.isOKExWallet || p.isOkxWallet || p.isOKX)));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isOKExWallet || provider?.isOkxWallet || provider?.isOKX || /(okx|okex)/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    },
    bitget: () => {
        const byWindow = !!((window.bitkeep && window.bitkeep.ethereum) ||
               (window.ethereum && window.ethereum.isBitKeep) ||
               (window.ethereum && window.ethereum.providers && window.ethereum.providers.some(p => p.isBitKeep)));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isBitKeep || /(bitget|bitkeep)/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    },
    phantom: () => {
        const byWindow = !!((window.phantom && window.phantom.ethereum) ||
               (window.ethereum && window.ethereum.isPhantom) ||
               (window.ethereum && window.ethereum.providers && window.ethereum.providers.some(p => p.isPhantom)));
        const byEip = eip6963Providers.some(({ provider, info }) =>
            provider?.isPhantom || /phantom/i.test((info?.rdns || info?.name || ''))
        );
        return byWindow || byEip;
    }
};

// Wait for wallet extensions to load
function waitForWalletExtensions() {
    return new Promise((resolve) => {
        // Check multiple times as extensions inject asynchronously
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkWallets = () => {
            attempts++;
            const wallets = {
                ethereum: !!window.ethereum,
                okxwallet: !!window.okxwallet,
                okex: !!window.okex,
                bitkeep: !!window.bitkeep,
                phantom: !!window.phantom,
                trustwallet: !!window.trustwallet,
                coinbaseWalletExtension: !!window.coinbaseWalletExtension,
                eip6963: eip6963Providers.length > 0
            };
            
            console.log(`Wallet check attempt ${attempts}:`, wallets);
            
            // If we found any wallets or reached max attempts, resolve
            if (Object.values(wallets).some(Boolean) || attempts >= maxAttempts) {
                console.log('Final wallet detection result:', wallets);
                resolve();
            } else {
                // Try again in 500ms
                setTimeout(checkWallets, 500);
            }
        };
        
        // Start checking after DOM is ready
        if (document.readyState === 'complete') {
            setTimeout(checkWallets, 100);
        } else {
            window.addEventListener('load', () => {
                setTimeout(checkWallets, 100);
            });
        }
    });
}
// Additional DOM elements will be initialized in initializeDOMElements()

// EIP-6963 provider discovery setup
let eip6963Initialized = false;
function requestEIP6963Providers() {
    try {
        // Some wallets expect CustomEvent, fall back to Event for compatibility
        window.dispatchEvent(new CustomEvent('eip6963:requestProvider'));
    } catch (_) {
        window.dispatchEvent(new Event('eip6963:requestProvider'));
    }
}
function setupEIP6963Discovery() {
    if (eip6963Initialized) return;
    eip6963Initialized = true;
    try {
        window.addEventListener('eip6963:announceProvider', (event) => {
            const detail = event?.detail || {};
            const prov = detail.provider;
            const info = detail.info || {};
            if (!prov) return;
            const exists = eip6963Providers.some(p => p.provider === prov);
            if (!exists) {
                eip6963Providers.push({ provider: prov, info });
                console.log('EIP-6963 provider announced:', info);
                // Refresh modal availability when new provider arrives
                if (typeof updateWalletModal === 'function') {
                    updateWalletModal();
                }
            }
        });
        // Request providers to announce themselves
        requestEIP6963Providers();
        // Retry shortly after load in case extensions are late
        setTimeout(requestEIP6963Providers, 500);
        // Re-request when tab becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) requestEIP6963Providers();
        });
    } catch (e) {
        console.log('EIP-6963 setup error:', e);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Check if a specific wallet is available
 */
function isWalletAvailable(walletType) {
    // For debugging - show all available window objects
    if (walletType === 'metamask') {
        console.log('All window objects:', Object.keys(window).filter(key => 
            key.toLowerCase().includes('eth') || 
            key.toLowerCase().includes('wallet') || 
            key.toLowerCase().includes('meta') ||
            key.toLowerCase().includes('okx') ||
            key.toLowerCase().includes('phantom') ||
            key.toLowerCase().includes('trust') ||
            key.toLowerCase().includes('coinbase') ||
            key.toLowerCase().includes('bitkeep')
        ));
    }
    
    const detector = walletDetectors[walletType];
    const result = detector ? detector() : false;
    
    console.log(`Wallet detection for ${walletType}:`, {
        result,
        windowEthereum: !!window.ethereum,
        windowOkxwallet: !!window.okxwallet,
        windowOkex: !!window.okex,
        windowBitkeep: !!window.bitkeep,
        windowPhantom: !!window.phantom,
        windowTrustwallet: !!window.trustwallet,
        ethereumProviders: window.ethereum?.providers?.length || 0,
        ethereumFlags: window.ethereum ? {
            isMetaMask: window.ethereum.isMetaMask,
            isCoinbaseWallet: window.ethereum.isCoinbaseWallet,
            isTrust: window.ethereum.isTrust,
            isOKExWallet: window.ethereum.isOKExWallet,
            isOkxWallet: window.ethereum.isOkxWallet,
            isOKX: window.ethereum.isOKX,
            isBitKeep: window.ethereum.isBitKeep,
            isPhantom: window.ethereum.isPhantom
        } : null
    });
    
    return result;
}

/**
 * Update wallet modal to show only available wallets
 */
async function updateWalletModal() {
    await waitForWalletExtensions();
    
    const walletOptions = document.querySelectorAll('.wallet-option');
    walletOptions.forEach(option => {
        const walletType = option.dataset.wallet;
        const isAvailable = isWalletAvailable(walletType);
        
        if (!isAvailable && walletType !== 'walletconnect') {
            option.style.opacity = '0.5';
            // Don't disable pointer events - let them click to see error message
            const walletNameElement = option.querySelector('.wallet-name');
            const walletName = walletNameElement ? walletNameElement.textContent : 'Wallet';
            option.title = `${walletName} is not installed`;
        } else {
            option.style.opacity = '1';
            option.title = '';
        }
    });
}

/**
 * Initialize DOM elements
 */
function initializeDOMElements() {
    // Main elements
    connectBtn = document.getElementById('connectBtn');
    disconnectBtn = document.getElementById('disconnectBtn');
    walletModal = document.getElementById('walletModal');
    walletInfo = document.getElementById('walletInfo');
    connectionStatus = document.getElementById('connectionStatus');
    walletDetails = document.getElementById('walletDetails');
    walletType = document.getElementById('walletType');
    walletAddress = document.getElementById('walletAddress');
    ethBalance = document.getElementById('ethBalance');
    networkName = document.getElementById('networkName');
    nftGrid = document.getElementById('nftGrid');
    nftLoading = document.getElementById('nftLoading');
    noNftsMessage = document.getElementById('noNftsMessage');
    darkModeToggle = document.getElementById('darkModeToggle');
    darkModeIcon = document.getElementById('darkModeIcon');
    nftSection = document.getElementById('nftSection');
    refreshNftsBtn = document.getElementById('refreshNftsBtn');
    copyAddressBtn = document.getElementById('copyAddressBtn');
    refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
    
    // Toast elements
    errorToast = document.getElementById('errorToast');
    successToast = document.getElementById('successToast');
    errorMessage = document.getElementById('errorMessage');
    successMessage = document.getElementById('successMessage');
    closeModal = document.getElementById('closeModal');
}

/**
 * Initialize the application
 * Set up event listeners and check for existing connections
 */
async function initializeApp() {
    try {
        // Initialize DOM elements first
        initializeDOMElements();
        
        // Start EIP-6963 provider discovery early
        setupEIP6963Discovery();
        
        // Wait for wallet extensions to load
        await waitForWalletExtensions();
        
        // Set up event listeners
        setupEventListeners();
        
        // Initialize dark mode
        initializeDarkMode();
        
        // Update wallet modal with available wallets
        await updateWalletModal();
        
        // Check for existing wallet connections
        await checkExistingConnections();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Failed to initialize application');
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Check if elements exist before adding listeners
    if (connectBtn) connectBtn.addEventListener('click', showWalletModal);
    if (disconnectBtn) disconnectBtn.addEventListener('click', () => {
        try { localStorage.setItem('userDisconnected', 'true'); } catch (_) {}
        disconnectWallet();
    });
    
    // Utility buttons
    if (copyAddressBtn) copyAddressBtn.addEventListener('click', copyAddress);
    if (refreshBalanceBtn) refreshBalanceBtn.addEventListener('click', refreshBalance);
    if (refreshNftsBtn) refreshNftsBtn.addEventListener('click', loadNFTs);
    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);
    
    // Modal controls
    if (closeModal) closeModal.addEventListener('click', hideWalletModal);
    if (walletModal) {
        walletModal.addEventListener('click', (e) => {
            if (e.target === walletModal) hideWalletModal();
        });
    }
    
    // Wallet option buttons - add event delegation to handle dynamically updated options
    if (walletModal) {
        walletModal.addEventListener('click', (e) => {
            const walletOption = e.target.closest('.wallet-option');
            if (walletOption) {
                e.preventDefault();
                e.stopPropagation();
                const walletType = walletOption.dataset.wallet;
                if (walletType) {
                    connectWallet(walletType);
                    hideWalletModal();
                }
            }
        });
    }
    
    // Keyboard accessibility
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !walletModal.classList.contains('hidden')) {
            hideWalletModal();
        }
    });
}

/**
 * Check for existing wallet connections
 */
async function checkExistingConnections() {
    // If user explicitly disconnected, skip all auto-reconnect logic
    const userDisconnected = localStorage.getItem('userDisconnected') === 'true';
    if (userDisconnected) {
        console.log('Skip auto-reconnect due to manual disconnect flag');
        return;
    }
    // Check MetaMask via EIP-6963 or multi-provider arrays first
    try {
        let mmProvider = null;
        const eip = eip6963Providers.find(({ provider, info }) =>
            provider?.isMetaMask || /metamask/i.test((info?.rdns || info?.name || ''))
        );
        if (eip) {
            mmProvider = eip.provider;
        } else if (window.ethereum && Array.isArray(window.ethereum.providers)) {
            mmProvider = window.ethereum.providers.find(p => p && p.isMetaMask);
        } else if (window.ethereum && window.ethereum.isMetaMask) {
            mmProvider = window.ethereum;
        }

        if (mmProvider) {
            const accounts = await mmProvider.request({ method: 'eth_accounts' });
            if (Array.isArray(accounts) && accounts.length > 0) {
                await connectWallet(WALLET_TYPES.METAMASK, true);
                return;
            }
        }
    } catch (error) {
        console.log('No existing MetaMask connection');
    }

    // Prefer restoring WalletConnect if a session exists
    const savedWallet = localStorage.getItem('connectedWallet');
    const hasWcSession = !!localStorage.getItem('walletconnect');
    if (hasWcSession && (!savedWallet || savedWallet === WALLET_TYPES.WALLETCONNECT)) {
        try {
            await connectWallet(WALLET_TYPES.WALLETCONNECT, true);
            return;
        } catch (error) {
            console.log('WalletConnect reconnection failed');
        }
    }

    // Fallback: try restore previously saved wallet
    if (savedWallet) {
        try {
            await connectWallet(savedWallet, true);
        } catch (error) {
            console.log('Failed to restore saved wallet connection');
            localStorage.removeItem('connectedWallet');
        }
    }
}

/**
 * Show wallet selection modal
 */
function showWalletModal() {
    walletModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    // Refresh availability each time modal opens
    if (typeof updateWalletModal === 'function') {
        updateWalletModal();
    }
    // Ask wallets to announce again on demand
    if (typeof requestEIP6963Providers === 'function') {
        requestEIP6963Providers();
    }
}

/**
 * Hide wallet selection modal
 */
function hideWalletModal() {
    walletModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

/**
 * Connect to wallet based on type
 */
async function connectWallet(walletType, isReconnection = false) {
    try {
        if (!isReconnection) setConnectButtonLoading(true);
        
        // Check if wallet is available before attempting connection
        if (walletType !== WALLET_TYPES.WALLETCONNECT && !isWalletAvailable(walletType)) {
            throw new Error(`${getWalletDisplayName(walletType)} is not installed. Please install the extension first.`);
        }
        
        switch (walletType) {
            case WALLET_TYPES.METAMASK:
                await connectMetaMask();
                break;
            case WALLET_TYPES.WALLETCONNECT:
                await connectWalletConnect(isReconnection);
                break;
            case WALLET_TYPES.COINBASE:
                await connectCoinbaseWallet();
                break;
            case WALLET_TYPES.TRUST:
                await connectTrustWallet();
                break;
            case WALLET_TYPES.OKX:
                await connectOKXWallet();
                break;
            case WALLET_TYPES.BITGET:
                await connectBitgetWallet();
                break;
            case WALLET_TYPES.PHANTOM:
                await connectPhantomWallet();
                break;
            default:
                throw new Error('Unsupported wallet type');
        }
        
        // Store wallet type for future sessions
        currentWalletType = walletType;
        localStorage.setItem('connectedWallet', walletType);
        // Clear manual disconnect guard now that user connected a wallet
        try { localStorage.removeItem('userDisconnected'); } catch (_) {}
        
        // Update UI
        await updateWalletUI();
        
        if (!isReconnection) {
            showSuccess(`${getWalletDisplayName(walletType)} connected successfully!`);
        }
        
    } catch (error) {
        console.error('Error connecting wallet:', error);
        if (isReconnection) {
            console.log('Reconnection attempt failed:', error?.message || error);
        } else {
            showError(error.message || 'Failed to connect wallet');
        }
        setConnectButtonLoading(false);
    }
}

/**
 * Connect to MetaMask
 */
async function connectMetaMask() {
    // Prefer EIP-6963 announced provider if available
    let walletProvider = null;
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isMetaMask || /metamask/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.ethereum && (window.ethereum.isMetaMask || (window.ethereum.providers && window.ethereum.providers.some(p => p.isMetaMask)))) {
        walletProvider = window.ethereum.isMetaMask ? window.ethereum : (window.ethereum.providers ? window.ethereum.providers.find(p => p.isMetaMask) : window.ethereum);
    } else {
        throw new Error('MetaMask is not installed. Please install MetaMask extension.');
    }

    // Request account access
    const accounts = await walletProvider.request({ method: 'eth_requestAccounts' });

    if (accounts.length === 0) {
        throw new Error('No accounts found in MetaMask');
    }

    // Initialize provider and signer
    provider = new ethers.providers.Web3Provider(walletProvider);
    signer = provider.getSigner();
    userAccount = accounts[0];

    // Set up event listeners for MetaMask
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Connect to WalletConnect
 */
async function connectWalletConnect(isReconnection = false) {
    try {
        // Determine correct constructor for UMD build
        const WCProviderCtor = (typeof WalletConnectProvider !== 'undefined' && (WalletConnectProvider.default || WalletConnectProvider)) || null;
        if (!WCProviderCtor) {
            throw new Error('WalletConnect library not loaded');
        }

        // Initialize WalletConnect provider (avoid Infura dependency; use public RPCs)
        walletConnectProvider = new WCProviderCtor({
            rpc: {
                1: 'https://cloudflare-eth.com',
                5: 'https://rpc.ankr.com/eth_goerli',
                11155111: 'https://rpc.sepolia.org',
                137: 'https://polygon-rpc.com',
                56: 'https://bsc-dataseed.binance.org'
            },
            chainId: 1,
            qrcode: !isReconnection,
            qrcodeModalOptions: {
                mobileLinks: [
                    'rainbow',
                    'metamask',
                    'argent',
                    'trust',
                    'imtoken',
                    'pillar'
                ]
            }
        });
        
        // Enable session (QR Code modal shown only if qrcode: true)
        await walletConnectProvider.enable();
        
        // Initialize ethers provider
        provider = new ethers.providers.Web3Provider(walletConnectProvider);
        signer = provider.getSigner();
        userAccount = walletConnectProvider.accounts[0];
        
        // Set up event listeners
        walletConnectProvider.on('accountsChanged', handleAccountsChanged);
        walletConnectProvider.on('chainChanged', handleChainChanged);
        walletConnectProvider.on('disconnect', () => {
            disconnectWallet();
        });
        
    } catch (error) {
        throw new Error('Failed to connect with WalletConnect: ' + error.message);
    }
}

/**
 * Connect to Coinbase Wallet
 */
async function connectCoinbaseWallet() {
    // Check for Coinbase Wallet in multiple ways
    let walletProvider = null;

    // Prefer EIP-6963 provider if available
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isCoinbaseWallet || /coinbase/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.ethereum && window.ethereum.isCoinbaseWallet) {
        walletProvider = window.ethereum;
    } else if (window.coinbaseWalletExtension) {
        walletProvider = window.coinbaseWalletExtension;
    } else if (window.ethereum && window.ethereum.providers) {
        // Check for Coinbase in multiple providers
        walletProvider = window.ethereum.providers.find(p => p.isCoinbaseWallet);
    } else if (window.ethereum) {
        // Fallback to generic ethereum provider
        walletProvider = window.ethereum;
    } else {
        throw new Error('Coinbase Wallet is not installed. Please install Coinbase Wallet extension.');
    }
    
    provider = new ethers.providers.Web3Provider(walletProvider);
    
    // Request account access
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
        throw new Error('No accounts found in Coinbase Wallet');
    }
    
    signer = provider.getSigner();
    userAccount = accounts[0];
    
    // Set up event listeners
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Connect to Trust Wallet
 */
async function connectTrustWallet() {
    // Check for Trust Wallet in multiple ways
    let walletProvider = null;

    // Prefer EIP-6963 provider if available
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isTrust || /trust\s*wallet/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.ethereum && window.ethereum.isTrust) {
        walletProvider = window.ethereum;
    } else if (window.trustwallet) {
        walletProvider = window.trustwallet;
    } else if (window.ethereum && window.ethereum.providers) {
        // Check for Trust Wallet in multiple providers
        walletProvider = window.ethereum.providers.find(p => p.isTrust);
    } else if (window.ethereum) {
        // Fallback to generic ethereum provider
        walletProvider = window.ethereum;
    } else {
        throw new Error('Trust Wallet is not installed. Please install Trust Wallet or use Trust Wallet browser.');
    }
    
    provider = new ethers.providers.Web3Provider(walletProvider);
    
    // Request account access
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
        throw new Error('No accounts found in Trust Wallet');
    }
    
    signer = provider.getSigner();
    userAccount = accounts[0];
    
    // Set up event listeners
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Connect to OKX Wallet
 */
async function connectOKXWallet() {
    // Check for OKX Wallet in multiple ways
    let walletProvider = null;

    // Prefer EIP-6963 provider if available
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isOKExWallet || provider?.isOkxWallet || provider?.isOKX || /(okx|okex)/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.okxwallet) {
        walletProvider = window.okxwallet;
    } else if (window.okex) {
        walletProvider = window.okex;
    } else if (window.ethereum && (window.ethereum.isOKExWallet || window.ethereum.isOkxWallet || window.ethereum.isOKX)) {
        walletProvider = window.ethereum;
    } else if (window.ethereum && window.ethereum.providers) {
        // Check for OKX in multiple providers
        walletProvider = window.ethereum.providers.find(p => p.isOKExWallet || p.isOkxWallet || p.isOKX);
    } else if (window.ethereum) {
        // Fallback to generic ethereum provider
        walletProvider = window.ethereum;
    } else {
        throw new Error('OKX Wallet is not installed. Please install OKX Wallet extension.');
    }
    
    // Request account access
    const accounts = await walletProvider.request({ 
        method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) {
        throw new Error('No accounts found in OKX Wallet');
    }
    
    // Initialize provider and signer
    provider = new ethers.providers.Web3Provider(walletProvider);
    signer = provider.getSigner();
    userAccount = accounts[0];
    
    // Set up event listeners
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Connect to Bitget Wallet
 */
async function connectBitgetWallet() {
    // Check for Bitget Wallet in multiple ways
    let walletProvider = null;

    // Prefer EIP-6963 provider if available
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isBitKeep || /(bitget|bitkeep)/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.bitkeep && window.bitkeep.ethereum) {
        walletProvider = window.bitkeep.ethereum;
    } else if (window.ethereum && window.ethereum.isBitKeep) {
        walletProvider = window.ethereum;
    } else if (window.ethereum && window.ethereum.providers) {
        // Check for Bitget in multiple providers
        walletProvider = window.ethereum.providers.find(p => p.isBitKeep);
    } else if (window.ethereum) {
        // Fallback to generic ethereum provider
        walletProvider = window.ethereum;
    } else {
        throw new Error('Bitget Wallet is not installed. Please install Bitget Wallet extension.');
    }
    
    // Request account access
    const accounts = await walletProvider.request({ 
        method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) {
        throw new Error('No accounts found in Bitget Wallet');
    }
    
    // Initialize provider and signer
    provider = new ethers.providers.Web3Provider(walletProvider);
    signer = provider.getSigner();
    userAccount = accounts[0];
    
    // Set up event listeners
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Connect to Phantom Wallet
 */
async function connectPhantomWallet() {
    // Check for Phantom Wallet in multiple ways
    let walletProvider = null;

    // Prefer EIP-6963 provider if available
    const eip = eip6963Providers.find(({ provider, info }) =>
        provider?.isPhantom || /phantom/i.test((info?.rdns || info?.name || ''))
    );
    if (eip) {
        walletProvider = eip.provider;
    } else if (window.phantom && window.phantom.ethereum) {
        walletProvider = window.phantom.ethereum;
    } else if (window.ethereum && window.ethereum.isPhantom) {
        walletProvider = window.ethereum;
    } else if (window.ethereum && window.ethereum.providers) {
        // Check for Phantom in multiple providers
        walletProvider = window.ethereum.providers.find(p => p.isPhantom);
    } else if (window.ethereum) {
        // Fallback to generic ethereum provider
        walletProvider = window.ethereum;
    } else {
        throw new Error('Phantom Wallet is not installed. Please install Phantom Wallet extension.');
    }
    
    // Request account access
    const accounts = await walletProvider.request({ 
        method: 'eth_requestAccounts' 
    });
    
    if (accounts.length === 0) {
        throw new Error('No accounts found in Phantom Wallet');
    }
    
    // Initialize provider and signer
    provider = new ethers.providers.Web3Provider(walletProvider);
    signer = provider.getSigner();
    userAccount = accounts[0];
    
    // Set up event listeners
    if (walletProvider.on) {
        walletProvider.on('accountsChanged', handleAccountsChanged);
        walletProvider.on('chainChanged', handleChainChanged);
    }
}

/**
 * Disconnect wallet
 */
async function disconnectWallet() {
    try {
        // Disconnect WalletConnect if active
        if (walletConnectProvider && walletConnectProvider.connected) {
            await walletConnectProvider.disconnect();
        }
        
        // Clear variables
        provider = null;
        signer = null;
        userAccount = null;
        currentWalletType = null;
        walletConnectProvider = null;
        
        // Clear localStorage
        localStorage.removeItem('connectedWallet');
        
        // Update UI
        updateDisconnectedUI();
        
        showSuccess('Wallet disconnected successfully');
        
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        showError('Failed to disconnect wallet');
    }
}

/**
 * Update UI when wallet is connected
 */
async function updateWalletUI() {
    try {
        // Update connection status
        connectionStatus.innerHTML = `
            <i class="fas fa-check-circle status-icon" style="color: #10b981;"></i>
            <p style="color: #10b981;">Wallet Connected</p>
        `;
        
        // Show wallet details and hide connect button
        walletDetails.classList.remove('hidden');
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
        
        // Display wallet type
        walletType.textContent = getWalletDisplayName(currentWalletType);
        
        // Display wallet address (shortened)
        walletAddress.textContent = shortenAddress(userAccount);
        
        // Get and display ETH balance
        await updateBalance();
        
        // Get and display network
        await updateNetwork();
        
        // Show NFT section and load NFTs
        nftSection.classList.remove('hidden');
        await loadNFTs();
        
        setConnectButtonLoading(false);
        
    } catch (error) {
        console.error('Error updating wallet UI:', error);
        showError('Failed to load wallet information');
        setConnectButtonLoading(false);
    }
}

/**
 * Update UI when wallet is disconnected
 */
function updateDisconnectedUI() {
    walletDetails.classList.add('hidden');
    nftSection.classList.add('hidden');
    connectBtn.classList.remove('hidden');
    disconnectBtn.classList.add('hidden');
    
    connectionStatus.innerHTML = `
        <i class="fas fa-plug status-icon"></i>
        <p>Connect your wallet to get started</p>
    `;
    
    setConnectButtonLoading(false);
}

/**
 * Set connect button loading state
 */
function setConnectButtonLoading(isLoading) {
    if (isLoading) {
        connectBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>';
        connectBtn.disabled = true;
    } else {
        connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        connectBtn.disabled = false;
    }
}

/**
 * Update ETH balance
 */
async function updateBalance() {
    try {
        const balance = await provider.getBalance(userAccount);
        const ethBalanceFormatted = parseFloat(ethers.utils.formatEther(balance)).toFixed(2);
        ethBalance.textContent = ethBalanceFormatted;
    } catch (error) {
        console.error('Error getting balance:', error);
        ethBalance.textContent = 'Error';
    }
}

/**
 * Update network information
 */
async function updateNetwork() {
    try {
        const network = await provider.getNetwork();
        const networkNames = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            11155111: 'Sepolia Testnet',
            137: 'Polygon Mainnet',
            80001: 'Mumbai Testnet',
            56: 'BSC Mainnet',
            97: 'BSC Testnet'
        };
        
        networkName.textContent = networkNames[network.chainId] || `Chain ID: ${network.chainId}`;
    } catch (error) {
        console.error('Error getting network:', error);
        networkName.textContent = 'Unknown';
    }
}

/**
 * Load NFTs from OpenSea API
 */
async function loadNFTs() {
    try {
        nftLoading.classList.remove('hidden');
        nftGrid.innerHTML = '';
        noNftsMessage.classList.add('hidden');
        
        // Use OpenSea API (note: may require API key for production)
        const response = await fetch(`https://api.opensea.io/api/v1/assets?owner=${userAccount}&limit=20`, {
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch NFTs');
        }
        
        const data = await response.json();
        const nfts = data.assets || [];
        
        nftLoading.classList.add('hidden');
        
        if (nfts.length === 0) {
            noNftsMessage.classList.remove('hidden');
            return;
        }
        
        // Display NFTs
        nfts.forEach(nft => {
            const nftCard = createNFTCard(nft);
            nftGrid.appendChild(nftCard);
        });
        
    } catch (error) {
        console.error('Error loading NFTs:', error);
        nftLoading.classList.add('hidden');
        noNftsMessage.classList.remove('hidden');
        noNftsMessage.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 15px; display: block;"></i>
            <p style="color: #ef4444; margin-bottom: 10px;">Failed to load NFTs</p>
            <p style="font-size: 0.9rem; color: #6b7280;">OpenSea API might be rate limited</p>
        `;
    }
}

/**
 * Create NFT card element
 */
function createNFTCard(nft) {
    const card = document.createElement('div');
    card.className = 'nft-card';
    
    const imageUrl = nft.image_url || nft.image_preview_url || 'https://via.placeholder.com/250x250?text=No+Image';
    const name = nft.name || 'Unnamed NFT';
    const collection = nft.collection?.name || 'Unknown Collection';
    
    card.innerHTML = `
        <img src="${imageUrl}" alt="${name}" class="nft-image" 
             onerror="this.src='https://via.placeholder.com/250x250?text=No+Image'">
        <div class="nft-info">
            <h3 class="nft-name">${name}</h3>
            <p class="nft-collection">${collection}</p>
        </div>
    `;
    
    // Add click handler to view on OpenSea
    card.addEventListener('click', () => {
        if (nft.permalink) {
            window.open(nft.permalink, '_blank');
        }
    });
    
    return card;
}

/**
 * Refresh balance
 */
async function refreshBalance() {
    const originalIcon = refreshBalanceBtn.innerHTML;
    refreshBalanceBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i>';
    
    await updateBalance();
    
    setTimeout(() => {
        refreshBalanceBtn.innerHTML = originalIcon;
    }, 1000);
}

/**
 * Copy wallet address to clipboard
 */
async function copyAddress() {
    try {
        await navigator.clipboard.writeText(userAccount);
        
        const originalIcon = copyAddressBtn.innerHTML;
        copyAddressBtn.innerHTML = '<i class="fas fa-check" style="color: #10b981;"></i>';
        showSuccess('Address copied to clipboard!');
        
        setTimeout(() => {
            copyAddressBtn.innerHTML = originalIcon;
        }, 2000);
    } catch (error) {
        showError('Failed to copy address');
    }
}

/**
 * Get display name for wallet type
 */
function getWalletDisplayName(walletType) {
    const names = {
        [WALLET_TYPES.METAMASK]: 'MetaMask',
        [WALLET_TYPES.WALLETCONNECT]: 'WalletConnect',
        [WALLET_TYPES.COINBASE]: 'Coinbase Wallet',
        [WALLET_TYPES.TRUST]: 'Trust Wallet',
        [WALLET_TYPES.OKX]: 'OKX Wallet',
        [WALLET_TYPES.BITGET]: 'Bitget Wallet',
        [WALLET_TYPES.PHANTOM]: 'Phantom'
    };
    return names[walletType] || 'Unknown Wallet';
}

/**
 * Shorten wallet address for display
 */
function shortenAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Handle account changes
 */
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else if (accounts[0] !== userAccount) {
        userAccount = accounts[0];
        await updateWalletUI();
        showSuccess('Account changed successfully');
    }
}

/**
 * Handle chain changes
 */
function handleChainChanged(chainId) {
    // Reload the page when chain changes for simplicity
    window.location.reload();
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    darkModeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('darkMode', isDark);
}

/**
 * Initialize dark mode from localStorage
 */
function initializeDarkMode() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
        document.body.classList.add('dark');
        darkModeIcon.className = 'fas fa-sun';
    }
}

/**
 * Show error message
 */
function showError(message) {
    errorMessage.textContent = message;
    errorToast.classList.remove('hidden');
    errorToast.classList.add('show');
    
    setTimeout(() => {
        errorToast.classList.remove('show');
        setTimeout(() => {
            errorToast.classList.add('hidden');
        }, 300);
    }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
    successMessage.textContent = message;
    successToast.classList.remove('hidden');
    successToast.classList.add('show');
    
    setTimeout(() => {
        successToast.classList.remove('show');
        setTimeout(() => {
            successToast.classList.add('hidden');
        }, 300);
    }, 3000);
}

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred');
});

// Note: Do not auto-disconnect WalletConnect on unload to preserve session and improve reconnection.
