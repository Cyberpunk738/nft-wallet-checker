# Multi-Wallet Web3 Viewer

A complete Web3 application with support for multiple wallets including MetaMask, WalletConnect, Coinbase Wallet, and Trust Wallet. Displays wallet details and NFT collections with a modern, responsive design.

## Features

✅ **Multi-Wallet Support**
- **MetaMask** - Browser extension wallet
- **WalletConnect** - Mobile wallet connection via QR code
- **Coinbase Wallet** - Coinbase's self-custody wallet
- **Trust Wallet** - Mobile-first crypto wallet
- Automatic wallet detection and reconnection
- Account and network change handling

✅ **Wallet Information Display**
- Connected wallet type identification
- Shortened wallet address (0x1234...abcd format)
- ETH balance with 2 decimal places
- Current network information
- Copy address to clipboard functionality

✅ **NFT Collection Viewer**
- Fetches NFTs using OpenSea API
- Responsive grid layout with hover effects
- Click to view NFTs on OpenSea
- Loading states and error handling
- Fallback images for missing NFT artwork

✅ **Modern UI/UX**
- **Custom CSS** - No framework dependencies
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark/Light Mode** - Toggle with persistence
- **Smooth Animations** - CSS transitions and hover effects
- **Toast Notifications** - Success/error feedback
- **Modal Interface** - Clean wallet selection
- **Accessibility** - Keyboard navigation and focus states

✅ **Error Handling**
- Wallet not installed detection
- Connection failure recovery
- API rate limiting graceful degradation
- Network error handling
- Comprehensive error messages

## Technologies Used

- **HTML5** - Semantic markup structure
- **Custom CSS** - Modern styling without frameworks
- **JavaScript (ES6+)** - Modern JavaScript features
- **Ethers.js v5.7.2** - Ethereum blockchain interaction
- **WalletConnect v1.8.0** - Multi-wallet connection protocol
- **OpenSea API** - NFT metadata fetching
- **Font Awesome** - Icon library

## File Structure

```
NfT viewer/
├── index.html          # Main HTML structure
├── styles.css          # Custom CSS styling (no frameworks)
├── script.js           # JavaScript with multi-wallet support
└── README.md          # Documentation
```

## Quick Start

### Option 1: Local Development
1. Open `index.html` in a modern web browser
2. Click "Connect Wallet" to see wallet options
3. Choose your preferred wallet from the modal
4. Follow wallet-specific connection prompts

### Option 2: Deploy to Netlify/Vercel
1. Upload all files (`index.html`, `styles.css`, `script.js`) to your hosting platform
2. Deploy and access via the provided URL

## Supported Wallets

### MetaMask
- **Requirements**: MetaMask browser extension
- **Connection**: Direct browser integration
- **Features**: Full functionality including automatic reconnection

### WalletConnect
- **Requirements**: Any WalletConnect-compatible mobile wallet
- **Connection**: QR code scanning
- **Features**: Mobile wallet integration, secure connection
- **Note**: Requires Infura ID for production use

### Coinbase Wallet
- **Requirements**: Coinbase Wallet extension or mobile app
- **Connection**: Browser extension or mobile connection
- **Features**: Self-custody wallet integration

### Trust Wallet
- **Requirements**: Trust Wallet mobile app or browser extension
- **Connection**: Browser integration or mobile connection
- **Features**: Multi-chain wallet support

## Usage

1. **Choose Wallet**: Click "Connect Wallet" to see all available options
2. **Connect**: Select your preferred wallet and follow connection prompts
3. **View Details**: See wallet type, address, ETH balance, and network
4. **Browse NFTs**: Scroll down to view your NFT collection
5. **Dark Mode**: Toggle between light and dark themes
6. **Copy Address**: Click the copy icon to copy your wallet address
7. **Refresh**: Update balance and NFT collection with refresh buttons

## Configuration

### WalletConnect Setup
For production use with WalletConnect, update the Infura ID in `script.js`:

```javascript
// Replace "your-infura-id" with your actual Infura project ID
walletConnectProvider = new WalletConnectProvider.default({
    infuraId: "your-actual-infura-id",
    rpc: {
        1: "https://mainnet.infura.io/v3/your-actual-infura-id",
        5: "https://goerli.infura.io/v3/your-actual-infura-id",
    },
    // ... rest of config
});
```

### OpenSea API
For production use, consider getting an OpenSea API key to avoid rate limits.

## Browser Compatibility

- **Chrome/Chromium** (recommended)
- **Firefox**
- **Safari**
- **Edge**
- **Mobile browsers** (for WalletConnect)

## Code Structure

The application is built with separate files for maintainability:

- **HTML Structure**: Semantic layout with accessibility in mind
- **CSS Styling**: Custom CSS with modern design patterns
- **JavaScript Logic**: Modular functions with comprehensive error handling

### Key JavaScript Functions

- `connectWallet(walletType)` - Handles connection to different wallet types
- `updateWalletUI()` - Updates all wallet information displays
- `loadNFTs()` - Fetches and displays NFT collection
- `toggleDarkMode()` - Theme switching with persistence
- `showWalletModal()` - Displays wallet selection interface

## Security Considerations

- No private keys are stored or transmitted
- All interactions go through wallet's secure interface
- API calls are made to public endpoints only
- No sensitive data is logged or stored
- Wallet connections are handled by respective wallet providers

## Troubleshooting

**Wallet not connecting?**
- Refresh the page and try again
- Check if your wallet is unlocked
- Make sure you're on a supported network
- Try a different wallet option

**NFTs not loading?**
- This may be due to OpenSea API rate limits
- Try refreshing after a few minutes
- Check browser console for detailed error messages

**Balance showing as 0?**
- Make sure you're connected to the correct network
- Try the refresh button next to the balance
- Check if your wallet has ETH on the current network

**WalletConnect not working?**
- Ensure your mobile wallet supports WalletConnect
- Check your internet connection
- Try scanning the QR code again

## License

This project is open source and available under the MIT License.
