// File: api/getClaimableBalances.js (Vercel के लिए)

const { Keypair, Horizon } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

const server = new Horizon.Server("https://api.mainnet.minepi.com", {
    httpClient: axios.create({ timeout: 30000 })
});

const createKeypairFromMnemonic = (mnemonic) => {
    try {
        return Keypair.fromRawEd25519Seed(derivePath("m/44'/314159'/0'", mnemonicToSeedSync(mnemonic).toString('hex')).key);
    } catch (e) {
        throw new Error("Invalid keyphrase. Please check for typos or extra spaces.");
    }
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { mnemonic } = req.body;
        if (!mnemonic) return res.status(400).json({ success: false, error: "Keyphrase is required." });

        const keypair = createKeypairFromMnemonic(mnemonic);
        const response = await server.claimableBalances().claimant(keypair.publicKey()).limit(100).call();
        
        const balances = response.records.map(r => ({ id: r.id, amount: r.amount, asset: "PI" }));

        return res.status(200).json({ success: true, balances, publicKey: keypair.publicKey() });

    } catch (error) {
        console.error("Error in getClaimableBalances:", error);
        let detailedError = "An unknown error occurred.";
        if (error.message.includes("Invalid keyphrase")) {
            detailedError = error.message;
        } else if (error.response && error.response.status === 404) {
            detailedError = "This account was not found on the Pi network.";
        } else if (error.message.toLowerCase().includes('timeout')) {
            detailedError = "Request to Pi network timed out.";
        } else {
            detailedError = error.message;
        }
        return res.status(200).json({ success: false, error: detailedError });
    }
};```

---

### **स्टेप 2: `submitTransaction.js` को बदलें**

1.  अपने `api` फोल्डर में `submitTransaction.js` फाइल बनाएँ/खोलें।
2.  इसके अंदर का भी **सारा कोड हटा दें**।
3.  नीचे दिया गया **पूरा कोड पेस्ट करें**।

```javascript
// File: api/submitTransaction.js (Vercel के लिए)

const { Keypair, Horizon, Operation, TransactionBuilder, Asset } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

const server = new Horizon.Server("https://api.mainnet.minepi.com", {
    httpClient: axios.create({ timeout: 30000 })
});

const createKeypairFromMnemonic = (mnemonic) => {
    try {
        return Keypair.fromRawEd25519Seed(derivePath("m/44'/314159'/0'", mnemonicToSeedSync(mnemonic).toString('hex')).key);
    } catch (e) {
        throw new Error("Invalid keyphrase. Please check for typos or extra spaces.");
    }
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const params = req.body;
        const senderKeypair = createKeypairFromMnemonic(params.senderMnemonic);
        let sponsorKeypair = null;
        if (params.feeType === 'SPONSOR_PAYS' && params.sponsorMnemonic) {
            sponsorKeypair = createKeypairFromMnemonic(params.sponsorMnemonic);
        }

        const sourceAccountKeypair = (params.feeType === 'SPONSOR_PAYS') ? sponsorKeypair : senderKeypair;
        const accountToLoad = await server.loadAccount(sourceAccountKeypair.publicKey());
        const fee = await server.fetchBaseFee();
        
        const tx = new TransactionBuilder(accountToLoad, { fee, networkPassphrase: "Pi Network" });

        if (params.operation === 'claim_and_transfer') {
            tx.addOperation(Operation.claimClaimableBalance({
                balanceId: params.claimableId,
                source: senderKeypair.publicKey()
            }));
        }
        
        tx.addOperation(Operation.payment({
            destination: params.receiverAddress,
            asset: Asset.native(),
            amount: params.amount.toString(),
            source: senderKeypair.publicKey()
        }));

        const transaction = tx.setTimeout(60).build();
        transaction.sign(senderKeypair);
        if (params.feeType === 'SPONSOR_PAYS') {
            transaction.sign(sponsorKeypair);
        }
        
        const result = await server.submitTransaction(transaction);

        if (result && result.hash) {
             return res.status(200).json({ success: true, response: result });
        } else {
            throw new Error("Transaction was submitted but no hash was returned.");
        }

    } catch (error) {
        console.error("Error in submitTransaction:", error);
        let detailedError = "An unknown error occurred during transaction.";
        if (error.response?.data?.extras?.result_codes) {
            detailedError = "Transaction Failed: " + JSON.stringify(error.response.data.extras.result_codes);
        } else if (error.response?.status === 404) {
            detailedError = "The sender or sponsor account was not found on the Pi network.";
        } else if (error.message.toLowerCase().includes('timeout')) {
            detailedError = "Request to Pi network timed out.";
        } else {
            detailedError = error.message;
        }
        return res.status(200).json({ success: false, error: detailedError });
    }
};