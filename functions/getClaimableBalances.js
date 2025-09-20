// File: functions/getClaimableBalances.js (Netlify ke liye sahi kiya gaya)

const { Keypair, Horizon } = require('stellar-sdk');
const { mnemonicToSeedSync } = require('bip39');
const { derivePath } = require('ed25519-hd-key');
const axios = require('axios');

// Netlify ke handler ka format
exports.handler = async (event, context) => {
    // Sirf POST requests ko allow karein
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }

    try {
        // Vercel ka 'req.body' Netlify mein 'event.body' hota hai (aur use parse karna padta hai)
        const { mnemonic } = JSON.parse(event.body);
        if (!mnemonic) {
            return {
                statusCode: 400,
                body: JSON.stringify({ success: false, error: "Keyphrase is required." })
            };
        }
        
        const server = new Horizon.Server("https://api.mainnet.minepi.com", {
            httpClient: axios.create({ timeout: 20000 }) // Timeout thoda kam kiya
        });

        const createKeypairFromMnemonic = (m) => {
            try {
                return Keypair.fromRawEd25519Seed(derivePath("m/44'/314159'/0'", mnemonicToSeedSync(m).toString('hex')).key);
            } catch (e) {
                throw new Error("Invalid keyphrase. Please check for typos or extra spaces.");
            }
        };

        const keypair = createKeypairFromMnemonic(mnemonic);
        const response = await server.claimableBalances().claimant(keypair.publicKey()).limit(100).call();
        
        const balances = response.records.map(r => ({ id: r.id, amount: r.amount, asset: "PI" }));

        // Vercel ka 'res.status().json()' Netlify mein is tarah return hota hai
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, balances, publicKey: keypair.publicKey() })
        };

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
        
        return {
            // Success response mein error bhejein taaki front-end use dikha sake
            statusCode: 200, 
            body: JSON.stringify({ success: false, error: detailedError })
        };
    }
};
